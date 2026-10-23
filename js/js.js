const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === "production") {
  throw new Error(
    "Esta version de laboratorio no esta preparada para produccion."
  );
}

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

app.use(
  session({
    name: "securelab.sid",
    secret:
      process.env.SESSION_SECRET ||
      "solo-para-pruebas-locales-cambia-este-secreto",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      maxAge: 15 * 60 * 1000
    }
  })
);

// Usuarios ficticios: solo para el laboratorio local.
const users = new Map();

async function initializeUsers() {
  const adminPassword = process.env.LAB_ADMIN_PASSWORD;
  const userPassword = process.env.LAB_USER_PASSWORD;

  if (!adminPassword || !userPassword) {
    throw new Error(
      "Configura LAB_ADMIN_PASSWORD y LAB_USER_PASSWORD antes de iniciar."
    );
  }

  if (
    adminPassword.length < 12 ||
    userPassword.length < 12 ||
    adminPassword === userPassword
  ) {
    throw new Error(
      "Usa contrasenas distintas de al menos 12 caracteres."
    );
  }

  users.set("adminlab", {
    username: "adminlab",
    passwordHash: await bcrypt.hash(adminPassword, 12),
    role: "admin"
  });

  users.set("alumno", {
    username: "alumno",
    passwordHash: await bcrypt.hash(userPassword, 12),
    role: "user"
  });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos. Espera 15 minutos."
  }
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      error: "Debes iniciar sesion."
    });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    console.warn(
      JSON.stringify({
        event: "admin_access_denied",
        username: req.session.user?.username || "anonimo",
        time: new Date().toISOString()
      })
    );

    return res.status(403).json({
      error: "Acceso denegado. Se requiere rol administrador."
    });
  }

  next();
}

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/login", loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      username.length > 50 ||
      password.length > 200
    ) {
      return res.status(400).json({
        error: "Datos de inicio de sesion no validos."
      });
    }

    const user = users.get(username.trim().toLowerCase());

    const valid = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!valid) {
      console.warn(
        JSON.stringify({
          event: "login_failed",
          username: username.slice(0, 50),
          time: new Date().toISOString()
        })
      );

      return res.status(401).json({
        error: "Usuario o contrasena incorrectos."
      });
    }

    // Cambia el identificador de sesion al autenticar.
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.user = {
        username: user.username,
        role: user.role
      };

      req.session.save((saveError) => {
        if (saveError) return next(saveError);

        res.json({
          message: "Sesion iniciada.",
          user: req.session.user
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/me", requireLogin, (req, res) => {
  res.json({ user: req.session.user });
});

app.get("/api/admin", requireAdmin, (req, res) => {
  res.json({
    message: "Acceso autorizado al panel de laboratorio.",
    role: "admin",
    note: "Solo datos ficticios de prueba."
  });
});

app.post("/api/logout", requireLogin, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);

    res.clearCookie("securelab.sid", {
      httpOnly: true,
      sameSite: "strict",
      secure: false
    });

    res.json({ message: "Sesion cerrada." });
  });
});

app.use((err, req, res, next) => {
  console.error("Error interno:", err.message);
  res.status(500).json({
    error: "Error interno del servidor."
  });
});

initializeUsers()
  .then(() => {
    app.listen(PORT, "127.0.0.1", () => {
      console.log(`SECURELAB disponible en http://127.0.0.1:${PORT}`);
      console.log("Servidor de laboratorio local iniciado.");
    });
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });