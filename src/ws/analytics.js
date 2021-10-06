const server = require('../app');

const socketCount = (roomName)=>{
    console.log(server.io.sockets.sockets);
}

module.exports = {socketCount}
