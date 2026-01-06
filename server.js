const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.static('public'));

// Estado del servidor
let state = {
    users: {},
    seats: Array.from({length: 60}, (_, i) => ({
        number: i + 1,
        userId: null,
        userName: null,
        vote: null
    })),
    currentSession: null,
    chatMessages: [],
    onlineUsers: 0
};

io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado:', socket.id);
    state.onlineUsers++;
    updateOnlineCount();

    // Enviar estado actual
    socket.emit('session_data', {
        users: Object.values(state.users),
        seats: state.seats,
        currentSession: state.currentSession,
        chatMessages: state.chatMessages
    });

    // Usuario se une
    socket.on('user_join', (user) => {
        user.socketId = socket.id;
        state.users[user.id] = user;
        
        // Asignar asiento si es diputado
        if (user.type === 'deputy' && user.seatNumber) {
            const seatIndex = state.seats.findIndex(s => s.number === user.seatNumber);
            if (seatIndex !== -1) {
                state.seats[seatIndex].userId = user.id;
                state.seats[seatIndex].userName = user.name;
            }
        }
        
        console.log('Usuario conectado:', user.name);
        socket.broadcast.emit('user_joined', user);
        broadcastState();
    });

    // Usuario vota
    socket.on('cast_vote', (voteData) => {
        const user = state.users[voteData.userId];
        if (!user || user.type !== 'deputy') return;
        
        if (!state.currentSession) {
            socket.emit('error', 'No hay sesión activa');
            return;
        }

        // Actualizar voto
        const seatIndex = state.seats.findIndex(s => s.number === voteData.seatNumber);
        if (seatIndex !== -1) {
            state.seats[seatIndex].vote = voteData.vote;
            state.seats[seatIndex].userId = user.id;
            state.seats[seatIndex].userName = user.name;
        }

        console.log('Voto registrado:', user.name, voteData.vote);
        io.emit('vote_update', voteData);
        broadcastState();
    });

    // Mensaje de chat
    socket.on('chat_message', (message) => {
        state.chatMessages.push(message);
        if (state.chatMessages.length > 100) {
            state.chatMessages = state.chatMessages.slice(-100);
        }
        io.emit('chat_message', message);
    });

    // Crear sesión (admin)
    socket.on('create_session', (session) => {
        const user = getUserBySocket(socket.id);
        if (!user || user.type !== 'admin') {
            socket.emit('error', 'No autorizado');
            return;
        }

        // Reiniciar votos
        state.seats.forEach(seat => {
            seat.vote = null;
        });

        state.currentSession = session;
        state.chatMessages = [];
        
        console.log('Nueva sesión creada:', session.name);
        io.emit('session_created', session);
        broadcastState();
    });

    // Reiniciar votos
    socket.on('reset_votes', () => {
        const user = getUserBySocket(socket.id);
        if (!user || user.type !== 'admin') {
            socket.emit('error', 'No autorizado');
            return;
        }

        state.seats.forEach(seat => {
            seat.vote = null;
        });

        console.log('Votos reiniciados');
        io.emit('votes_reset');
        broadcastState();
    });

    // Finalizar sesión
    socket.on('end_session', () => {
        const user = getUserBySocket(socket.id);
        if (!user || user.type !== 'admin') {
            socket.emit('error', 'No autorizado');
            return;
        }

        state.currentSession = null;
        console.log('Sesión finalizada');
        io.emit('session_ended');
        broadcastState();
    });

    // Usuario desconectado
    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
        state.onlineUsers--;
        updateOnlineCount();

        // Encontrar y eliminar usuario
        const userId = Object.keys(state.users).find(id => state.users[id].socketId === socket.id);
        if (userId) {
            const user = state.users[userId];
            delete state.users[userId];
            
            // Liberar asiento
            const seatIndex = state.seats.findIndex(s => s.userId === userId);
            if (seatIndex !== -1) {
                state.seats[seatIndex].userId = null;
                state.seats[seatIndex].userName = null;
                state.seats[seatIndex].vote = null;
            }
            
            console.log('Usuario desconectado:', user?.name);
            io.emit('user_left', userId);
            broadcastState();
        }
    });
});

function getUserBySocket(socketId) {
    return Object.values(state.users).find(user => user.socketId === socketId);
}

function broadcastState() {
    io.emit('state_update', {
        seats: state.seats,
        currentSession: state.currentSession,
        onlineUsers: state.onlineUsers
    });
}

function updateOnlineCount() {
    io.emit('online_count', state.onlineUsers);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
