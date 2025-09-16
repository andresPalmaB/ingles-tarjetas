// pages/api/seed.js
import clientPromise from '../../lib/mongodb';

export default async function handler(req, res) {
    try {
        const client = await clientPromise;
        const db = client.db('ingles');

        // Paso 1: Insertar la historia
        const historia = {
            titulo: 'Presentation Yourself',
            orden: 1,
        };

        const historiaInsertada = await db.collection('historias').insertOne(historia);

        // Paso 2: Insertar frases relacionadas
        const frases = [
            ["Hello, my name is David.", "Hola mi nombre es David."],
            ["I am thirty-two years old.", "Tengo treinta y dos años de edad."],
            ["I live in Colombia.", "Vivo en Colombia."],
            ["I am from the United States.", "Soy de Estados Unidos."],
            ["I am married.", "Estoy casado."],
            ["My wife and I have three children.", "Mi esposa y yo tenemos tres hijos."],
            ["I have two sons and one daughter.", "Tengo dos hijos y una hija."],
            ["Their names are John, Kevin, and Ann.", "Sus nombres son John, Kevin y Ann."],
            ["We also have a dog.", "También tenemos un perro."],
            ["The dog’s name is Buster.", "El nombre del perro es Buster."],
            ["I am a postman.", "Soy cartero."],
            ["I deliver the mail each day.", "Entrego el correo todos los días."],
            ["I like to eat American food.", "Me gusta comer comida americana."],
            ["Hot dogs are delicious.", "Los perros calientes son deliciosos."],
            ["I also like to cook.", "También me gusta cocinar."],
            ["Cakes are my favorite food to bake.", "Los pasteles son mi comida favorita para hornear."],
            ["Cakes are also my favorite food to eat.", "Los pasteles también son mi comida favorita para comer."],
            ["I also enjoy exercising.", "También disfruto hacer ejercicio."],
            ["I like to run and hike.", "Me gusta correr y hacer senderismo."],
            ["After eating hot dogs and cakes, I need to exercise.", "Después de comer perros calientes y pasteles, necesito hacer ejercicio."]
        ].map(([textoIngles, traduccion]) => ({
            textoIngles,
            traduccion,
            historiaId: historiaInsertada.insertedId,
            fechaUltimoEstudio: null,
            nivelActual: 0,
            ultimaRespuesta: null,
        }));

        await db.collection('frases').insertMany(frases);

        res.status(200).json({ message: 'Historia y frases insertadas con éxito ✅' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al insertar los datos' });
    }
}
