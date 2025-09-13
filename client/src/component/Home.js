import React, { useState } from "react";
import { v4 as uuid } from "uuid";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

function Home() {
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  // Generate new unique room ID
  const generateRoomId = (e) => {
    e.preventDefault();
    const id = uuid();
    setRoomId(id);
    toast.success("Room ID generated successfully!");
  };

  // Join the room
  const joinRoom = () => {
    if (!roomId.trim() || !username.trim()) {
      toast.error("Room ID and Username are required!");
      return;
    }

    // Navigate to editor with roomId & username
    navigate(`/editor/${roomId}`, {
      state: { username }, // ✅ no "Guest" fallback needed
    });

    toast.success(`Joined Room: ${roomId}`);
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      joinRoom();
    }
  };

  return (
    <div className="container-fluid">
      <div className="row justify-content-center align-items-center min-vh-100">
        <div className="col-12 col-md-6">
          <div className="card shadow-sm p-2 mb-5 bg-secondary rounded">
            <div className="card-body text-center bg-dark">
              <img
                className="img-fluid mx-auto d-block"
                src="/images/FullLogo.png"
                alt="CodeSphere"
                style={{ maxWidth: "150px" }}
              />

              <h4 className="text-light">Enter the Room ID</h4>

              {/* Room ID Input */}
              <div className="form-group">
                <input
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  onKeyDown={handleKeyPress}
                  type="text"
                  className="form-control mt-3"
                  placeholder="Enter Room ID"
                />
              </div>

              {/* Username Input */}
              <div className="form-group">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyPress}
                  type="text"
                  className="form-control mt-3"
                  placeholder="Enter Username"
                />
              </div>

              {/* Join Button */}
              <button
                onClick={joinRoom}
                className="btn btn-primary btn-block mt-3"
              >
                Join
              </button>

              <p className="mt-3 text-light">
                Don’t have a room ID?
                <span
                  className="text-primary pt-2"
                  style={{ cursor: "pointer" }}
                  onClick={generateRoomId}
                >
                  {" "}
                  New Room
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
