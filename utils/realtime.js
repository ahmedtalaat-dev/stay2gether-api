const crypto = require("crypto");
const { WebSocket, WebSocketServer } = require("ws");

const { NotificationModel } = require("../models/notificationModel.js");
const { PostModel } = require("../models/postModel.js");
const { UserModel } = require("../models/userModel.js");

const { getUserFromToken } = require("./crypto.js");
const { isDbConnected } = require("../config/db.js");

let wssInstance = null;

const userSockets = new Map();
const socketToUser = new WeakMap();

function isUserOnline(userId) {
  return userSockets.has(userId);
}

function getOnlineUserIds() {
  return Array.from(userSockets.keys());
}

function sendJson(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function pushToUser(userId, payload) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;

  for (const ws of sockets) {
    sendJson(ws, payload);
  }
}

function broadcastAll(payload) {
  if (!wssInstance) return;

  for (const client of wssInstance.clients) {
    sendJson(client, payload);
  }
}

function initWebSocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
  });

  wssInstance = wss;

  wss.on("connection", (ws) => {
    sendJson(ws, {
      type: "presence:update",
      onlineUserIds: getOnlineUserIds(),
    });

    ws.on("message", async (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        // Authentication
        if (data.type === "auth" && typeof data.token === "string") {
          if (!isDbConnected()) {
            sendJson(ws, {
              type: "auth:error",
              error: "Database unavailable",
            });
            return;
          }

          const user = await getUserFromToken(data.token);

          if (!user) {
            sendJson(ws, {
              type: "auth:error",
              error: "Invalid token",
            });
            return;
          }

          const prevUserId = socketToUser.get(ws);

          if (prevUserId && prevUserId !== user.id) {
            userSockets.get(prevUserId)?.delete(ws);

            if (userSockets.get(prevUserId)?.size === 0) {
              userSockets.delete(prevUserId);
            }
          }

          socketToUser.set(ws, user.id);

          let set = userSockets.get(user.id);

          if (!set) {
            set = new Set();
            userSockets.set(user.id, set);
          }

          set.add(ws);

          sendJson(ws, {
            type: "auth:ok",
            userId: user.id,
            onlineUserIds: getOnlineUserIds(),
          });

          broadcastAll({
            type: "presence:update",
            onlineUserIds: getOnlineUserIds(),
          });
        }

        // Logout
        else if (data.type === "logout") {
          const uid = socketToUser.get(ws);

          if (uid) {
            userSockets.get(uid)?.delete(ws);

            if (userSockets.get(uid)?.size === 0) {
              userSockets.delete(uid);
            }

            socketToUser.delete(ws);

            broadcastAll({
              type: "presence:update",
              onlineUserIds: getOnlineUserIds(),
            });
          }
        }

        // Typing indicator
        else if (
          data.type === "typing" &&
          typeof data.conversationId === "string" &&
          typeof data.recipientId === "string" &&
          typeof data.isTyping === "boolean"
        ) {
          const senderId = socketToUser.get(ws);

          if (!senderId) return;

          pushToUser(data.recipientId, {
            type: "typing",
            conversationId: data.conversationId,
            senderId,
            isTyping: data.isTyping,
          });
        }
      } catch (err) {
        // Ignore malformed WebSocket frames
      }
    });

    // Connection closed
    ws.on("close", () => {
      const uid = socketToUser.get(ws);

      if (uid) {
        userSockets.get(uid)?.delete(ws);

        if (userSockets.get(uid)?.size === 0) {
          userSockets.delete(uid);
        }

        socketToUser.delete(ws);

        broadcastAll({
          type: "presence:update",
          onlineUserIds: getOnlineUserIds(),
        });
      }
    });
  });

  return wss;
}

// Create notification
async function createNotification(params) {
  if (params.recipientId === params.actorId) return;

  const id = `ntf_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();

  await NotificationModel.create({
    _id: id,
    userId: params.recipientId,
    actorId: params.actorId,
    type: params.type,
    postId: params.postId ?? null,
    commentId: params.commentId ?? null,
    message: params.message ?? null,
    isRead: false,
    createdAt,
  });

  const actor = await UserModel.findById(params.actorId)
    .select("_id username displayName avatarUrl")
    .lean();

  let postSnippet = null;

  if (params.postId) {
    const p = await PostModel.findById(params.postId).select("content").lean();

    if (p?.content) {
      postSnippet = p.content.slice(0, 80);
    }
  }

  if (actor) {
    pushToUser(params.recipientId, {
      type: "notification:created",
      notification: {
        id,
        userId: params.recipientId,
        actorId: params.actorId,
        type: params.type,
        postId: params.postId ?? null,
        commentId: params.commentId ?? null,
        message: params.message ?? null,
        isRead: false,
        createdAt,
        actor: {
          id: actor._id,
          username: actor.username,
          displayName: actor.displayName,
          avatarUrl: actor.avatarUrl || "",
        },
        postSnippet,
      },
    });
  }
}

module.exports = {
  isUserOnline,
  getOnlineUserIds,
  sendJson,
  pushToUser,
  broadcastAll,
  initWebSocketServer,
  createNotification,
};
