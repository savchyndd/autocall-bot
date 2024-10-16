const express = require("express");
const logger = require("morgan");
const cors = require("cors");
require("dotenv").config();

const { initiateCall, createAndRegister } = require("./sipController");

const app = express();
const formatsLogger = app.get("env") === "dev" ? "dev" : "short";
app.use(logger(formatsLogger));
app.use(cors());
app.use(express.json());

// Start UserAgent
console.log("Starting JsSIP UA...");
const userAgent = createAndRegister();

app.post("/api/call", async (req, res) => {
  const { target } = req.body;
  if (!target) {
    console.log("Target number is missing in the request.");
    return res.status(400).json({ error: "Target number is required" });
  }

  try {
    initiateCall(userAgent, target, res);
  } catch (error) {
    console.error(`Failed to initiate call to ${target}:`, error);
    return res
      .status(500)
      .json({ error: `Failed to initiate call: ${error.message}` });
  }
});

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use((err, req, res, next) => {
  const { status = 500, message = "Server Error" } = err;
  res.status(status).json({ message });
});

module.exports = app;
