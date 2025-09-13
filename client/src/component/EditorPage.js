// src/component/EditorPage.js
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { initSocket } from "../Socket";
import Editor from "./Editor";
import toast from "react-hot-toast";
import "./EditorPage.css";

function EditorPage() {
  const socketRef = useRef(null);
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [tree, setTree] = useState({
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
  });
  const [activePath, setActivePath] = useState("src/main.cpp");

  // =======================
  // Socket setup
  // =======================
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      socketRef.current = await initSocket();
      if (!socketRef.current) {
        toast.error("❌ Socket connection failed");
        navigate("/");
        return;
      }

      socketRef.current.emit("join", {
        roomId,
        username: location.state?.username || "Guest",
      });

      socketRef.current.on("joined", ({ clients: joinedClients, projectTree, activePath: serverActive }) => {
        if (!mounted) return;
        setClients(joinedClients || []);
        if (projectTree) setTree(projectTree);
        if (serverActive) setActivePath(serverActive);
      });

      socketRef.current.on("tree-update", ({ projectTree, activePath }) => {
        if (projectTree) setTree(projectTree);
        if (activePath) setActivePath(activePath);
      });

      socketRef.current.on("disconnected", ({ socketId, username }) => {
        setClients((prev) => prev.filter((c) => c.socketId !== socketId));
        toast(`${username} left the room`, { icon: "👋" });
      });
    };

    init();

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.off("joined");
        socketRef.current.off("tree-update");
        socketRef.current.off("disconnected");
      }
    };
  }, [roomId, location.state, navigate]);

  // =======================
  // Tree Helpers
  // =======================
  const updateTree = (newTree, newActivePath = activePath) => {
    setTree(newTree);
    setActivePath(newActivePath);
    socketRef.current?.emit("tree-update", { roomId, projectTree: newTree, activePath: newActivePath });
  };

  const getNodeByPath = (tree, path) => {
    if (!path) return null;
    const parts = path.split("/");
    let current = tree;
    for (const p of parts) {
      if (!p) continue;
      current = current.children ? current.children[p] : current[p];
      if (!current) return null;
    }
    return current;
  };

  const addFile = (folderPath = "") => {
    const fileName = prompt("Enter new file name (e.g. script.js):");
    if (!fileName) return;

    const newTree = structuredClone(tree);
    let parent = folderPath ? getNodeByPath(newTree, folderPath) : newTree;
    if (!parent || parent.type !== "folder") parent = newTree;

    if (parent.children[fileName]) {
      toast.error("File already exists!");
      return;
    }

    parent.children[fileName] = { type: "file", code: "" }; // 👈 empty code
    updateTree(newTree, `${folderPath ? folderPath + "/" : ""}${fileName}`);
  };

  const addFolder = (folderPath = "") => {
    const folderName = prompt("Enter new folder name:");
    if (!folderName) return;

    const newTree = structuredClone(tree);
    let parent = folderPath ? getNodeByPath(newTree, folderPath) : newTree;
    if (!parent || parent.type !== "folder") parent = newTree;

    if (parent.children[folderName]) {
      toast.error("Folder already exists!");
      return;
    }

    parent.children[folderName] = { type: "folder", children: {} };
    updateTree(newTree);
  };

  const deleteNode = (path) => {
    const parts = path.split("/");
    const name = parts.pop();
    const parentPath = parts.join("/");
    const newTree = structuredClone(tree);
    let parent = parentPath ? getNodeByPath(newTree, parentPath) : newTree;
    if (parent && parent.children) {
      delete parent.children[name];
      updateTree(newTree, Object.keys(parent.children)[0] || null);
    }
  };

  // =======================
  // Sidebar Renderer
  // =======================
  const renderTree = (node, path = "") => {
    if (node.type === "file") {
      return (
        <li
          key={path}
          className={`explorer-item ${path === activePath ? "active" : ""}`}
          onClick={() => setActivePath(path)}
        >
          📄 {path.split("/").pop()}
          <span
            className="delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              deleteNode(path);
            }}
          >
            ❌
          </span>
        </li>
      );
    }

    if (node.type === "folder") {
      return (
        <li key={path}>
          <div className="explorer-folder">📂 {path.split("/").pop() || "root"}</div>
          <ul style={{ marginLeft: 16 }}>
            {Object.entries(node.children).map(([name, child]) =>
              renderTree(child, path ? `${path}/${name}` : name)
            )}
          </ul>
          <button className="small-btn" onClick={() => addFile(path)}>➕ File</button>
          <button className="small-btn" onClick={() => addFolder(path)}>📂 Folder</button>
        </li>
      );
    }
    return null;
  };

  // =======================
  // Actions
  // =======================
  const handleCopyRoomId = async () => {
    await navigator.clipboard.writeText(roomId);
    toast.success("✅ Room ID copied!");
  };

  const handleLeaveRoom = () => {
    if (socketRef.current) socketRef.current.disconnect();
    navigate("/");
  };

  const activeNode = getNodeByPath(tree, activePath);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <div className="sidebar">
        <h4>Project Explorer</h4>
        <ul style={{ flex: 1, overflowY: "auto" }}>
          {Object.entries(tree).map(([name, node]) => renderTree(node, name))}
        </ul>

        <button className="root-btn" onClick={() => addFile("")}>➕ File (root)</button>
        <button className="root-btn" onClick={() => addFolder("")}>📂 Folder (root)</button>
        <hr style={{ margin: "12px 0" }} />
        <button className="root-btn" onClick={handleCopyRoomId}>📋 Copy Room ID</button>
        <button className="root-btn danger" onClick={handleLeaveRoom}>🚪 Leave Room</button>

        <h4 style={{ marginTop: "12px" }}>Connected Users</h4>
        <ul style={{ flex: 1, overflowY: "auto" }}>
          {clients.map((client) => (
            <li key={client.socketId}>{client.username}</li>
          ))}
        </ul>
      </div>

      {/* Editor */}
      <div style={{ flex: 1 }}>
        {socketRef.current && activeNode && activeNode.type === "file" ? (
          <Editor
            socketRef={socketRef}
            roomId={roomId}
            activeFile={{ ...activeNode, path: activePath }}
          />
        ) : (
          <p style={{ color: "white", padding: 20 }}>Select a file to start editing</p>
        )}
      </div>
    </div>
  );
}

export default EditorPage;
