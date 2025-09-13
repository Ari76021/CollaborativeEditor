// server/index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ===============================
// Store connected users & project trees
// ===============================
const userSocketMap = {}; // socket.id -> username
const projectTrees = {};  // roomId -> { tree, activePath }

// Helper to get all connected clients in a room
function getAllConnectedClients(roomId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room) return [];
  return Array.from(room).map((socketId) => ({
    socketId,
    username: userSocketMap[socketId],
  }));
}

// ===============================
// Socket.IO handlers
// ===============================
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  socket.on("join", ({ roomId, username }) => {
    if (!roomId || !username) {
      socket.emit("error", { message: "Username and Room ID are required!" });
      return;
    }

    userSocketMap[socket.id] = username;
    socket.join(roomId);

    const clients = getAllConnectedClients(roomId);

    // If no project tree exists yet, initialize one
    if (!projectTrees[roomId]) {
      projectTrees[roomId] = {
        tree: {
          src: {
            type: "folder",
            children: {
              "main.cpp": {
                type: "file",
                code: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!";\n    return 0;\n}',
                language: "cpp",
              },
            },
          },
          "README.md": {
            type: "file",
            code: "# Project",
            language: "markdown",
          },
        },
        activePath: "src/main.cpp",
      };
    }

    // Send latest state to everyone
    io.to(roomId).emit("joined", {
      clients,
      projectTree: projectTrees[roomId].tree,
      activePath: projectTrees[roomId].activePath,
      username,
      socketId: socket.id,
    });
  });

  // ================
  // Handle file edits
  // ================
  socket.on("code-change", ({ roomId, code, language, path }) => {
    if (!roomId || !path) return;

    // update the tree node
    const project = projectTrees[roomId];
    if (project) {
      const node = getNodeByPath(project.tree, path);
      if (node && node.type === "file") {
        node.code = code;
        node.language = language;
      }
    }

    // broadcast to other clients
    socket.to(roomId).emit("code-change", { code, language, path });
  });

  // ================
  // Handle tree updates (add/delete file/folder)
  // ================
  socket.on("tree-update", ({ roomId, projectTree, activePath }) => {
    if (!roomId || !projectTree) return;
    projectTrees[roomId] = { tree: projectTree, activePath };
    socket.to(roomId).emit("tree-update", { projectTree, activePath });
  });

  // ================
  // Sync full project (for newly joined clients)
  // ================
  socket.on("sync-project", ({ roomId }) => {
    if (roomId && projectTrees[roomId]) {
      io.to(socket.id).emit("tree-update", {
        projectTree: projectTrees[roomId].tree,
        activePath: projectTrees[roomId].activePath,
      });
    }
  });

  // ================
  // Disconnect handling
  // ================
  socket.on("disconnecting", () => {
    const username = userSocketMap[socket.id];
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        socket.to(roomId).emit("disconnected", {
          socketId: socket.id,
          username,
        });
      }
    }
    delete userSocketMap[socket.id];
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

// ===============================
// Helper: navigate the project tree
// ===============================
function getNodeByPath(tree, path) {
  const parts = path.split("/");
  let current = tree;
  for (const p of parts) {
    if (!p) continue;
    current = current.children ? current.children[p] : current[p];
    if (!current) return null;
  }
  return current;
}

// ===============================
// REST APIs
// ===============================

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Run code using Judge0 CE public API
app.post("/run", async (req, res) => {
  const { language, code } = req.body;

  if (!language || !code) {
    return res.status(400).json({ output: "Missing language or code" });
  }

  // map simple language names to Judge0 language_id
  const languageMap = {
    javascript: 63, // Node.js 12.x
    python: 71,     // Python 3
    cpp: 54,        // C++ (GCC 9.2.0)
    c: 50,          // C (GCC 9.2.0)
    java: 62,       // Java (OpenJDK 13)
  };

  const languageId = languageMap[language];
  if (!languageId) {
    return res.json({ output: `Language ${language} not supported.` });
  }

  try {
    const response = await axios.post(
      "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
      {
        source_code: code,
        language_id: languageId,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 20000,
      }
    );

    const body = response.data || {};
    const output =
      body.stdout ||
      body.stderr ||
      body.compile_output ||
      body.message ||
      "No output";

    res.json({ output });
  } catch (err) {
    console.error("Execution failed:", err.message || err);
    const msg = err.response?.data || err.message || "Execution service failed";
    res.status(500).json({ output: "Execution failed: " + JSON.stringify(msg) });
  }
});

// ===============================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
