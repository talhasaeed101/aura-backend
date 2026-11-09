const express = require("express");
const rateLimit = require("express-rate-limit");
const { login, me, logout } = require("../controllers/authController");
const requireAdminAuth = require("../middleware/requireAdminAuth");
const csrfOriginCheck = require("../middleware/csrfOrigin");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
    errors: [],
  },
});

router.post("/login", loginLimiter, csrfOriginCheck, login);
router.get("/me", requireAdminAuth, me);
router.post("/logout", requireAdminAuth, csrfOriginCheck, logout);

module.exports = router;
