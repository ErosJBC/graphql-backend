const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const Cliente = require('../models/Cliente');
const Pedido = require('../models/Pedido');

const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: 'environment.env' });

const crearToken = (usuario, key, expiresIn) => {
    const { id, email, nombre, apellido } = usuario;

    return jwt.sign({ id, email, nombre, apellido }, key, { expiresIn });
}

// resolvers
const resolvers = {
    Query: {
        obtenerUsuario: async (_, {}, ctx) => {
            const { usuario } = ctx;
            return usuario;
        },
        obtenerProductos: async (_, { input }) => {
            try {
                const productos = await Producto.find({});
                return productos
            } catch (error) {
                console.log(error)
            }   
        },
        obtenerProductoById: async (_, { id }) => {
            const producto = await Producto.findById(id);
            if (!producto) throw new Error('Producto no encontrado');

            return producto;
        },
        obtenerClientes: async () => {
            try {
                const clientes = await Cliente.find({});
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerClientesByVendedor: async (_, {}, ctx) => {
            try {
                const { usuario } = ctx;
                const clientes = await Cliente.find({ vendedor: usuario.id });
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerClienteById: async(_, { id }, ctx) => {
            // Revisar si el cliente existe o no
            const { usuario } = ctx;
            const cliente = await Cliente.findById(id);
            if (!cliente) throw new Error('Cliente no encontrado');

            // Quien lo creó puede verlo
            if (cliente.vendedor.toString() !== usuario.id) throw new Error('No tienes las credenciales');

            return cliente;
        },
        obtenerPedidos: async () => {
            try {
                const pedidos = await Pedido.find({});
                return pedidos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerPedidosByVendedor: async (_, {}, ctx) => {
            try {
                const { usuario } = ctx;
                const pedidos = await Pedido.find({ vendedor: usuario.id }).populate('cliente');
                return pedidos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerPedidoById: async (_, { id }, ctx) => {
            const { usuario } = ctx;
            // Si el pedido existe o no
            const pedido = await Pedido.findById(id);
            if (!pedido) throw new Error('Pedido no encontrado');

            // Quien lo creó puede verlo
            if (pedido.vendedor.toString() !== usuario.id) throw new Error('No tienes las credenciales');

            // Retornar el pedido
            return pedido;
        },
        obtenerPedidosByEstado: async (_, { estado }, ctx) => {
            const { usuario } = ctx;
            const pedidos = await Pedido.find({ vendedor: usuario.id, estado: estado });

            return pedidos;
        },
        mejoresClientes: async () => {
            const clientes = await Pedido.aggregate([
                { $match: { estado: "COMPLETADO" } },
                { $group: {
                    _id: "$cliente",
                    total: { $sum: '$total' }
                }},
                { $lookup: {
                    from: 'clientes',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'cliente'
                }},
                { $limit: 10 },
                { $sort: { total: -1 }}
            ]);

            return clientes;
        },
        mejoresVendedores: async () => {
            const vendedores = await Pedido.aggregate([
                { $match: { estado: "COMPLETADO" } },
                { $group: {
                    _id: "$vendedor",
                    total: { $sum: '$total' }
                }},
                { $lookup: {
                    from: 'usuarios',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'vendedor'
                }},
                { $limit: 3 },
                { $sort: { total: -1 }}
            ]);

            return vendedores;
        },
        buscarProducto: async (_, { texto }) => {
            const productos = await Producto.find({ $text: { $search: texto }}).limit(10);

            return productos;
        }
    },
    Mutation: {
        nuevoUsuario: async (_, { input }) => {
            const { email, password } = input;
            // Revisar si el usuario ya está registrado
            const existeUsuario = await Usuario.findOne({ email });
            if (existeUsuario) throw new Error('El usuario ya está registrado');

            // Hashear password
            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password, salt);

            // Guardarlo en la base de datos
            try {
                const usuario = new Usuario(input);
                usuario.save();
                return usuario;
            } catch (error) {
                console.log(error);
            }
        },
        autenticarUsuario: async (_, { input }) => {
            const { email, password } = input;
            // Si el usuario existe
            const existeUsuario = await Usuario.findOne({ email });
            if (!existeUsuario) throw new Error('El usuario no existe');

            // Revisar si el password es correcto
            const passwordCorrecto = await bcryptjs.compare(password, existeUsuario.password);
            if (!passwordCorrecto) throw new Error('El password es incorrecto');

            // Crear el token
            return {
                token: crearToken(existeUsuario, process.env.SECRET_KEY, '24h')
            }
        },
        nuevoProducto: async (_, { input }) => {
            try {
                const producto = new Producto(input);
                // Almacenar en la bd
                const resultado = await producto.save();
                return resultado;
            } catch (error) {
                console.log(error);
            }
        },
        actualizarProducto: async (_, { id, input }) => {
            let producto = await Producto.findById(id);
            if (!producto) throw new Error('Producto no encontrado');

            // Guardarlo en la bd
            producto = await Producto.findOneAndUpdate({ _id: id }, input, { new: true });
            return producto;
        },
        eliminarProducto: async (_, { id }) => {
            let producto = await Producto.findById(id);
            if (!producto) throw new Error('Producto no encontrado');

            // Eliminar
            await Producto.findOneAndDelete({ _id: id });

            return "Producto eliminado";
        },
        nuevoCliente: async (_, { input }, ctx) => {
            const { email } = input;
            const { usuario } = ctx;

            // Verificar si el cliente ya está registrado
            const cliente = await Cliente.findOne({ email });
            if (cliente) throw new Error('El cliente ya está registrado');
            
            const nuevoCliente = new Cliente(input);
            
            // Asignar el vendedor
            nuevoCliente.vendedor = usuario.id;

            // Guardarlo en la bd
            try {
                const resultado = await nuevoCliente.save();
                return resultado;
            } catch (error) {
                console.log(error);
            }
        },
        actualizarCliente: async (_, { id, input }, ctx) => {
            const { usuario } = ctx;
            // Verificar si existe el cliente
            let cliente = await Cliente.findById(id);
            if (!cliente) throw new Error('Cliente no existe');

            // Verificar si el vendedor es quien edita
            if (cliente.vendedor.toString() !== usuario.id) throw new Error('No tienes las credenciales');

            // Guardar el cliente
            cliente = await Cliente.findOneAndUpdate({ _id: id }, input, { new: true });

            return cliente;
        },
        eliminarCliente: async (_, { id }, ctx) => {
            const { usuario } = ctx;
            // Verificar si existe el cliente
            let cliente = await Cliente.findById(id);
            if (!cliente) throw new Error('Cliente no existe');

            // Verificar si el vendedor es quien edita
            if (cliente.vendedor.toString() !== usuario.id) throw new Error('No tienes las credenciales');

            // Eliminar
            await Cliente.findOneAndDelete({ _id: id });

            return "Cliente eliminado";
        },
        nuevoPedido: async (_, { input }, ctx) => {
            const { cliente,  pedido } = input;
            const { usuario } = ctx;
            // Verificar si el cliente existe o no
            let clienteExiste = await Cliente.findById(cliente);
            if (!clienteExiste) throw new Error('El cliente no existe');

            // Verificar si el cliente es del vendedor
            if (clienteExiste
                .vendedor.toString() !== usuario.id) throw new Error('No tienes las credenciales');

            // Revisar que el stock esté disponible
            for await (const articulo of pedido) {
                const { id } = articulo;
                const producto = await Producto.findById(id);

                if (articulo.cantidad > producto.existencia) throw new Error(`El artículo ${producto.nombre} excede la cantidad disponible`);
                else {
                    // Resta la cantidad a lo disponible
                    producto.existencia -= articulo.cantidad;
                    await producto.save();
                }
            };
            
            // Crear un nuevo pedido
            const nuevoPedido = new Pedido(input);

            // Asignarle un vendedor
            nuevoPedido.vendedor = usuario.id;

            // Guardarlo en la base de datos
            const resultado = await nuevoPedido.save();

            return resultado.populate('cliente');
        },
        actualizarPedido: async (_, { id, input }, ctx) => {
            const { cliente, pedido } = input;
            const { usuario } = ctx;

            // Si el pedido existe
            const existePedido = await Pedido.findById(id);
            if (!existePedido) throw new Error('El pedido no existe');
            
            // Si el cliente existe
            const existeCliente = await Cliente.findById(cliente);
            if (!existeCliente) throw new Error('El cliente no existe');

            // Si el cliente y pedido pertenece al vendedor
            if (existeCliente.vendedor.toString() !== usuario.id) throw new Error('No tienes las credenciales')
            
            // Revisar el stock
            if (pedido) {
                for await (const articulo of pedido) {
                    const { id } = articulo;
                    const producto = await Producto.findById(id);
    
                    if (articulo.cantidad > producto.existencia) throw new Error(`El artículo ${producto.nombre} excede la cantidad disponible`);
                    else {
                        // Resta la cantidad a lo disponible
                        producto.existencia -= articulo.cantidad;
                        await producto.save();
                    }
                };
            }

            // Guardar el pedido
            const resultado = await Pedido.findOneAndUpdate({ _id: id }, input, { new: true });
            return resultado;
        },
        eliminarPedido: async (_, { id }, ctx) => {
            const { usuario } = ctx;
            // Verificar si el pedido existe o no
            const pedido = await Pedido.findById(id);
            if (!pedido) throw new Error('El pedido no existe');

            // Verificar si el vendedor es quien lo borra
            if (pedido.vendedor.toString() !== usuario.id) throw new Error('No tienes las credenciales');
            
            // Eliminar de la base de datos
            await Pedido.findOneAndDelete({ _id: id });
            return "Pedido eliminado";
        }
    }
}

module.exports = resolvers;