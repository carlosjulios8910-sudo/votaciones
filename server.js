const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Importante: Habilitar CORS para permitir conexiones desde Netlify/Render (Frontend)
const io = new Server(server, {
  cors: {
    origin: "*", // Permite cualquier origen. En producción, reemplace con la URL de su frontend.
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Estado Global de la Aplicación (Simulación de la Base de Datos)
let state = {
  currentSession: null, // { question: '¿Aprueba la ley X?', isActive: true }
  seats: {}, // { 'user1': { vote: 'favor', name: 'Dip. Perez' }, ... }
  chat: []
};

// --- Manejo de Conexiones y Eventos de Socket.IO ---
io.on('connection', (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  // Enviar el estado actual al cliente que se conecta
  socket.emit('initial_state', state);

  // 1. EVENTO: Manejar Login (Simulación)
  socket.on('login', (data) => {
    // Aquí iría la validación real de usuario.
    // Simulación: Asignar un ID de asiento y notificar.
    const user = { userId: socket.id, name: data.name, role: data.role };
    state.seats[socket.id] = { ...user, vote: 'pendiente' };
    
    // Notificar al cliente que inició sesión y enviar el estado global
    socket.emit('login_success', user);
    io.emit('state_update', state); // Broadcast a todos
  });

  // 2. EVENTO: Manejar Voto
  socket.on('vote', (data) => {
    if (state.currentSession && state.currentSession.isActive && state.seats[socket.id]) {
      state.seats[socket.id].vote = data.choice; // 'favor' o 'contra'
      console.log(`Voto registrado de ${state.seats[socket.id].name}: ${data.choice}`);
      // Notificar a todos sobre la actualización del estado
      io.emit('state_update', state);
    }
  });

  // 3. EVENTO: Manejar Chat
  socket.on('chat_message', (data) => {
    const user = state.seats[socket.id] || { name: 'Invitado' };
    const message = { 
        user: user.name, 
        message: data.message, 
        timestamp: new Date().toLocaleTimeString() 
    };
    state.chat.push(message);
    io.emit('chat_message', message); // Broadcast del mensaje
  });
  
  // 4. EVENTO: Manejar Desconexión
  socket.on('disconnect', () => {
    if (state.seats[socket.id]) {
      delete state.seats[socket.id];
      io.emit('state_update', state); // Notificar que un usuario se fue
    }
    console.log(`Usuario desconectado: ${socket.id}`);
  });

  // --- EVENTOS ADMINISTRATIVOS (Necesitaría validación de rol 'Admin' en un proyecto real) ---
  socket.on('admin_start_session', (question) => {
    state.currentSession = { question: question, isActive: true };
    // Reiniciar votos a 'pendiente' para todos los asientos
    Object.keys(state.seats).forEach(id => state.seats[id].vote = 'pendiente');
    io.emit('state_update', state);
  });

  socket.on('admin_end_session', () => {
    state.currentSession = null;
    io.emit('state_update', state);
  });
});


// --- Inicializar Servidor ---
server.listen(PORT, () => {
  console.log(`Servidor de Socket.IO corriendo en el puerto ${PORT}`);
});
