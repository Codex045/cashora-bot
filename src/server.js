require("dotenv").config();

const express = require("express");
const cors = require("cors");

const postbackRoutes = require("./routes/postback");
const cpxPostbackRoutes =
  require("./routes/cpxPostback");


const app = express();

const PORT = Number(
  process.env.PORT || 3000
);

app.use(cors());


app.use(
  express.json({
    limit: "1mb"
  })
);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "Cashora Backend",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});



app.use(
  "/api/postback",
  postbackRoutes
);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found."
  });
});

app.listen(PORT, () => {
  console.log(
    `🚀 Cashora API running on port ${PORT}`
  );
});
