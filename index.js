const { ApolloServer } = require('apollo-server');
const jwt = require('jsonwebtoken');
const typeDefs = require('./db/schema');
const resolvers = require('./db/resolvers');
require('dotenv').config({ path: 'environment.env' });

const connectDB = require('./config/db');

// Conectar a la base de datos
connectDB();

// servidor
const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
        const token = req.headers['authorization'] || '';
        if (token) {
            try {
                const usuario = jwt.verify(token.replace('Bearer ', ''), process.env.SECRET_KEY);
                return { usuario };
            } catch (error) {
                console.log('Hubo un error');
                console.log(error);
            }
        }
    }
});

// arrancar el servidor
server.listen({ port: process.env.PORT || 4000 }).then(({ url }) => {
    console.log(`Servidor listo en la URL ${url}`);
});