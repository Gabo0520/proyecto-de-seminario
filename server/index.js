const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const axios = require('axios'); 
const cors = require('cors');

const app = express();
const port = 3000;

// Configura aquí tus datos de conexión MySQL
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '1234',
  database: 'proyecto_de_seminario'
};

app.use(cors());
app.use(bodyParser.json());

// Ruta para registrar usuario
app.post('/registro', async (req, res) => {
  const { nombre, email, password, equiposFavoritos } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (rows.length > 0) {
      await connection.end();
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.execute(
      'INSERT INTO usuarios (nombre_completo, email, contraseña, rol, preferencias) VALUES (?, ?, ?, ?, ?)',
      [nombre, email, hashedPassword, 'usuario', equiposFavoritos || '']
    );

    await connection.end();

    res.status(201).json({ mensaje: 'Usuario registrado exitosamente' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});


// Ruta para login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(
      'SELECT * FROM usuarios WHERE email = ? OR nombre_completo = ?',
      [username, username]
    );

    await connection.end();

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.contraseña);

    if (!match) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      usuario: {
        id: user.id,
        nombre: user.nombre_completo,
        email: user.email,
        rol: user.rol,
        preferencias: user.preferencias 
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});



const API_KEY = 'c439da86b9114f9690b8574fa46537fb';





const leagues  = [
  { code: 'PL', name: 'Premier League' },
  { code: 'PD', name: 'La Liga' },
  { code: 'SA', name: 'Serie A' },
  { code: 'BL1', name: 'Bundesliga' },
  { code: 'FL1', name: 'Ligue 1' }
];

app.get('/api/equipo/:id', async (req, res) => {
  try {
    const response = await axios.get(`https://api.football-data.org/v4/teams/${req.params.id}`, {
      headers: { 'X-Auth-Token': API_KEY }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo obtener la información del equipo' });
  }
});

// Endpoint para obtener detalles de un jugador por teamId y playerId
app.get('/api/player/:teamId/:playerId', async (req, res) => {
  const { teamId, playerId } = req.params;

  try {
    const response = await axios.get(`https://api.football-data.org/v4/teams/${teamId}`, {
      headers: { 'X-Auth-Token': API_KEY }
    });

    const squad = response.data.squad || [];
    const player = squad.find(p => p.id.toString() === playerId);

    if (!player) {
      return res.status(404).json({ error: 'Jugador no encontrado en el equipo' });
    }

    res.json(player);

  } catch (error) {
    console.error('Error al obtener detalles del jugador:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al obtener detalles del jugador' });
  }
});



app.get('/api/equipos', async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: 'Falta parámetro query' });

  try {
    const promises = leagues.map(league =>
      axios.get(`https://api.football-data.org/v4/competitions/${league.code}/teams`, {
        params: { season: 2024 },
        headers: { 'X-Auth-Token': API_KEY }
      })
    );

    const results = await Promise.all(promises);

    let allTeams = [];
    results.forEach((r, index) => {
      if (r.data && r.data.teams) {
        console.log(`Liga ${leagues[index].name}: ${r.data.teams.length} equipos recibidos`);
        allTeams = allTeams.concat(r.data.teams);
      } else {
        console.log(`Liga ${leagues[index].name}: no se recibieron equipos`);
      }
    });

    console.log(`Total equipos combinados: ${allTeams.length}`);

    const filteredTeams = allTeams.filter(team =>
      team.name.toLowerCase().includes(query.toLowerCase())
    );

    console.log(`Equipos que coinciden con "${query}": ${filteredTeams.length}`);

    res.json({ equipos: filteredTeams.slice(0, 20) });

  } catch (error) {
    console.error('Error al buscar equipos:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al buscar equipos' });
  }
});


app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});


// Agrega esta ruta en tu server.js
app.get('/api/standings/:leagueId', async (req, res) => {
    const leagueId = req.params.leagueId;
    try {
        const response = await axios.get(
            `https://api.football-data.org/v4/competitions/${leagueId}/standings`,
            { headers: { 'X-Auth-Token': API_KEY } }
        );
        res.json(response.data);
    } catch (error) {
        console.error('Error al obtener tabla de posiciones:', error.response?.data || error.message);
        res.status(500).json({ error: 'Error al obtener tabla' });
    }
});

app.get('/api/scorers', async (req, res) => {
  try {
    const promises = leagues.map(async (league) => {
      const response = await axios.get(
        `https://api.football-data.org/v4/competitions/${league.code}/scorers`,
        { headers: { 'X-Auth-Token': API_KEY } }
      );
      return {
        league: league.code,
        leagueName: league.name,
        scorers: response.data.scorers
      };
    });

    const results = await Promise.all(promises);
    res.json({ success: true, data: results });

  } catch (error) {
    console.error('Error al obtener goleadores:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al obtener goleadores' });
  }
});




app.get('/api/topscorers/:leagueId', async (req, res) => {
  const leagueId = req.params.leagueId;
  try {
    const response = await axios.get(
      `https://api.football-data.org/v4/competitions/${leagueId}/scorers`,
      { headers: { 'X-Auth-Token': API_KEY } }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener goleadores:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al obtener goleadores' });
  }
});

const clave_api = 'dacfb2cd9ac175ba2147fb6a9e248856'; // Tu clave api-football
const API_HOST = 'v3.football.api-sports.io';

// Define ligas con id y nombre para usar correctamente
const LEAGUES = [
  { id: 39, name: 'Premier League' },
  { id: 140, name: 'La Liga' },
  { id: 78, name: 'Bundesliga' },
  { id: 135, name: 'Serie A' },
  { id: 61, name: 'Ligue 1' }
];

app.get('/api/fixtures/next/:count', async (req, res) => {
  const count = req.params.count || 10;
  try {
    const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
      params: { next: count },
      headers: { 'x-apisports-key': clave_api }
    });
    res.json({ fixtures: response.data.response });
  } catch (error) {
    console.error('Error al obtener próximos partidos:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al obtener próximos partidos' });
  }
});


// Endpoint para obtener máximos goleadores de todas las ligas
app.get('/api/topscorers/all', async (req, res) => {
  try {
    const promises = LEAGUES.map(league =>
      axios.get(`https://${API_HOST}/players/topscorers`, {
        params: { league: league.id, season: 2023 },
        headers: { 'x-apisports-key': clave_api }
      })
      .then(response => ({
        league: league.name,
        leagueId: league.id,
        scorers: response.data.response
      }))
    );

    const results = await Promise.all(promises);

    res.json(results);

  } catch (error) {
    console.error('Error al obtener máximos goleadores:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al obtener máximos goleadores' });
  }
});

// Endpoint para detalles de jugador por ID
app.get('/api/player/:id', async (req, res) => {
  try {
    const response = await axios.get(`https://${API_HOST}/players`, {
      params: { id: req.params.id, season: 2024 },
      headers: { 'x-apisports-key': clave_api }
    });

    if (!response.data.response || response.data.response.length === 0) {
      return res.status(404).json({ error: 'Jugador no encontrado' });
    }

    res.json(response.data.response[0]);

  } catch (error) {
    console.error('Error al obtener detalles del jugador:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al obtener detalles del jugador' });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;


app.get('/api/equipos', async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: 'Falta parámetro query' });

  try {
    const promises = LEAGUES.map(leagueId =>
      axios.get('https://v3.football.api-sports.io/teams', {
        params: { league: leagueId, season: 2023 },
        headers: { 'x-apisports-key': clave_api }
      })
    );

    const results = await Promise.all(promises);

    let allTeams = [];
    results.forEach((r, index) => {
      if (r.data && r.data.response) {
        console.log(`Liga ${LEAGUES[index]}: ${r.data.response.length} equipos recibidos`);
        allTeams = allTeams.concat(r.data.response);
      } else {
        console.log(`Liga ${LEAGUES[index]}: no se recibieron equipos`);
      }
    });

    console.log(`Total equipos combinados: ${allTeams.length}`);

    const filteredTeams = allTeams.filter(team =>
      team.team.name.toLowerCase().includes(query.toLowerCase())
    );

    console.log(`Equipos que coinciden con "${query}": ${filteredTeams.length}`);

    res.json({ equipos: filteredTeams.slice(0, 20) });

  } catch (error) {
    console.error('Error al buscar equipos:', error.message);
    res.status(500).json({ error: 'Error al buscar equipos' });
  }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});

app.get('/api/matches/live', async (req, res) => {
  try {
    const response = await axios.get(
      'https://v3.football.api-sports.io/fixtures?live=all',
      {
        headers: {
          'x-apisports-key': clave_api,
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener partidos en vivo:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al obtener partidos en vivo' });
  }
});

app.get('/api/matches/:fixtureId/statistics', async (req, res) => {
  const fixtureId = req.params.fixtureId;

  try {
    const response = await axios.get(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`,
      {
        headers: {
          'x-apisports-key': clave_api,
          // Si usas RapidAPI, agrega también:
          // 'x-rapidapi-host': 'v3.football.api-sports.io',
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al obtener estadísticas del partido' });
  }
});

// Eventos del partido
app.get('/api/matches/:fixtureId/events', async (req, res) => {
  const fixtureId = req.params.fixtureId;
  try {
    const response = await axios.get(
      `https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`,
      {
        headers: {
          'x-apisports-key': clave_api,
          'x-rapidapi-host': 'v3.football.api-sports.io',
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener eventos:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al obtener eventos del partido' });
  }
});

// Alineaciones del partido
app.get('/api/matches/:fixtureId/lineups', async (req, res) => {
  const fixtureId = req.params.fixtureId;
  try {
    const response = await axios.get(
      `https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixtureId}`,
      {
        headers: {
          'x-apisports-key': clave_api,
          'x-rapidapi-host': 'v3.football.api-sports.io',
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener alineaciones:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al obtener alineaciones del partido' });
  }
});




app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});



app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});

const crypto = require('crypto');
const nodemailer = require('nodemailer');

app.post('/recuperar-contrasena', async (req, res) => {
  const { email } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Buscar usuario por email
    const [rows] = await connection.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (rows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = rows[0];

    // Generar token y expiración
    const token = crypto.randomBytes(32).toString('hex');
    const expiration = Date.now() + 3600000; // 1 hora

    // Guardar token y expiración en BD
    await connection.execute(
      'UPDATE usuarios SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE id = ?',
      [token, expiration, user.id]
    );

    await connection.end();

    // Configurar y enviar email
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: 'tuemail@gmail.com',
        pass: 'tucontraseña'
      }
    });

    const resetUrl = `http://localhost:5500/restablecer-contrasena.html?token=${token}`;

    const mailOptions = {
      to: user.email,
      from: 'no-reply@matchpulse.com',
      subject: 'Restablecer tu contraseña',
      text: `Para restablecer tu contraseña, haz clic en el siguiente enlace:\n\n${resetUrl}\n\nSi no solicitaste esto, ignora este correo.`
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error al enviar el correo' });
      }
      res.json({ mensaje: 'Se ha enviado un enlace de recuperación a tu correo electrónico' });
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/restablecer-contrasena', async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Buscar usuario con token válido y no expirado
    const [rows] = await connection.execute(
      'SELECT * FROM usuarios WHERE resetPasswordToken = ? AND resetPasswordExpires > ?',
      [token, Date.now()]
    );

    if (rows.length === 0) {
      await connection.end();
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const user = rows[0];

    // Hashear la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Actualizar contraseña y limpiar token
    await connection.execute(
      'UPDATE usuarios SET contraseña = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );

    await connection.end();

    res.json({ mensaje: 'Contraseña restablecida correctamente' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

