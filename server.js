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

const state_idle = 0;
const state_role = 1;
const state_sunset = 2;
const state_wolfup = 3;
const state_wolfkill = 4;
const state_wolfdown = 5;
const state_witchup = 6;
const state_witchrescue = 7;
const state_witchpoison = 8;
const state_witchdown = 9;
const state_sunrise = 10;

let game_state = idle;

let stat_string = [];
stat_string[state_idle] = "準備中";
stat_string[state_role] = "確認角色身分";
stat_string[state_sunset] = "天黑請閉眼";
stat_string[state_wolfup] = "狼人請睜眼";
stat_string[state_wolfkill] = "狼人請殺人";
stat_string[state_wolfdown] = "狼人請閉眼";
stat_string[state_witchup] = "女巫請睜眼";
stat_string[state_witchrescue] = "他被殺死了，你要救他嗎";
stat_string[state_witchpoison] = "你要使用毒藥嗎";
stat_string[state_witchdown] = "女巫請閉眼";
stat_string[state_sunrise] = "天亮請睜眼";

const role_wolf = 0;
const role_witch = 1;
const role_civilian = 2;

let role_string = [];
role_string[role_wolf] = "狼人";
role_string[role_witch] = "女巫";
role_string[role_civilian] = "平民";

function game_process(user)
{
    switch (game_state) {
        case state_idle: 
        break;
        case state_role: 
        break;
        case state_sunset: 
        break;
        case state_wolfup: 
        break;
        case state_wolfkill: 
        break;
        case state_wolfdown: 
        break;
        case state_witchup: 
        break;
        case state_witchrescue: 
        break;
        case state_witchpoison: 
        break;
    }
}

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

  loginUsers[username] = { user: sess.user, socket: socket };
  socket.broadcast.emit("chatMessage", { user:"System", text:`${username} 加入聊天室` });

  socket.on("chatMessage", msg=>{
    io.emit("chatMessage", { user:username, text:msg });
  });

  socket.on("gameStart", function() {
    gstateMachine
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
