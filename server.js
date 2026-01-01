const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ----- SQLite -----
const db = new sqlite3.Database("./chat.db");
db.run(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)
`);

var game

// ----- Middleware -----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const sessionMiddleware = session({
  secret: "mySecretKeyForSession",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000*60*60*2 } // 2小時
});
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, "public")));

// ----- 登入狀態檢查 -----
function checkLogin(req, res, next){
  if(!req.session.user){
    return res.redirect("/login.html");
  }
  next();
}

// ----- 註冊 -----
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  if(!username || !password){
    return res.status(400).json({ message:"缺少帳號或密碼" });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.run("INSERT INTO users(username,password) VALUES(?,?)",
    [username, hash],
    function(err){
      if(err) return res.status(400).json({ message:"使用者已存在" });
      res.json({ message:"註冊成功" });
    });
});

// ----- 登入 -----
app.post("/api/login", (req,res)=>{
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username=?",[username],(err,user)=>{
    if(!user) return res.status(400).json({ message:"帳號不存在" });
    if(!bcrypt.compareSync(password,user.password))
      return res.status(400).json({ message:"密碼錯誤" });

    req.session.user = { id:user.id, username:user.username };
    res.json({ message:"登入成功" });
  });
});

// ----- 登出 -----
app.get("/api/logout", (req,res)=>{
  req.session.destroy(()=>{
    res.redirect("/login.html");
  });
});

// ----- Chat Page -----
app.get("/chat", checkLogin, (req,res)=>{
  res.sendFile(path.join(__dirname,"public","chat.html"));
});

// ----- Users -----
app.get("/api/users", (req,res)=>{
  let users = [];
  for (let name in loginUsers) {
    users.push(name);
  }
  console.log(users);
  res.json(users);
});

// ----- Socket.IO 與 session 共用 -----
io.use((socket, next)=>{
  sessionMiddleware(socket.request, {}, next);
});

let loginUsers = [];

io.on("connection", (socket)=>{
  const sess = socket.request.session;
  if(!sess.user) return;

  const username = sess.user.username;
  console.log(username + " connected");

  loginUsers[username] = { user: sess.user };
  socket.broadcast.emit("chatMessage", { user:"System", text:`${username} 加入聊天室` });

  socket.on("chatMessage", msg=>{
    io.emit("chatMessage", { user:username, text:msg });
  });

  socket.on("gameStart", function() {
    io.emit("chatMessage", { user:username, text:"Game Start" });
  });

  socket.on("disconnect", ()=>{
	delete loginUsers[username];
    io.emit("chatMessage", { user:"System", text:`${username} 離開聊天室` });
  });
});

server.listen(3000, ()=>{
  console.log("Server running on http://localhost:3000");
});
