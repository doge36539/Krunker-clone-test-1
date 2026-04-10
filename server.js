const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

const players = {};

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("joinServer", (data) => {
    socket.join(data.server); // Join the specific "Server" room

    players[socket.id] = {
      id: socket.id,
      x: 0,
      y: 2,
      z: 0,
      rotationY: 0,
      playerClass: data.class,
      server: data.server,
    };

    // Send existing players in this server to the new player
    const serverPlayers = {};
    for (let id in players) {
      if (players[id].server === data.server) {
        serverPlayers[id] = players[id];
      }
    }
    socket.emit("currentPlayers", serverPlayers);

    // Broadcast new player to others in the same server
    socket.to(data.server).emit("newPlayer", players[socket.id]);
  });

  socket.on("playerMovement", (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].z = movementData.z;
      players[socket.id].rotationY = movementData.rotationY;
      // Broadcast to the room
      socket
        .to(players[socket.id].server)
        .emit("playerMoved", players[socket.id]);
    }
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    if (players[socket.id]) {
      const serverRoom = players[socket.id].server;
      delete players[socket.id];
      io.to(serverRoom).emit("playerDisconnected", socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
