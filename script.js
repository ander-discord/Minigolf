const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const socket = new WebSocket('ws://localhost:8080');

let playerId = null;
let otherPlayers = {};

socket.addEventListener('open', () => {
  console.log('Connected to server');
});

let mapLoaded = false;
let hole = { x: 0, y: 0, radius: 15, color: 'black' };
let walls = [];
let ball = {
  x: 0,
  y: 0,
  radius: 10,
  color: `hsl(${Math.random() * 360}, 100%, 50%)`,
  vx: 0,
  vy: 0,
  moving: false
};
let finished = false;
let waiting = false;

socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'id') {
    playerId = data.id;
  } else if (data.type === 'players') {
    otherPlayers = {};
    for (const player of data.players) {
      if (player.id !== playerId) {
        otherPlayers[player.id] = player;
      }
    }
  } else if (data.type === 'waiting') {
    waiting = true;
  } else if (data.type === 'newLevel') {
    walls = data.walls;
    hole = data.hole;
    ball.x = data.ball.x;
    ball.y = data.ball.y;
    ball.vx = 0;
    ball.vy = 0;
    ball.moving = false;
    finished = false;
    waiting = false;
    mapLoaded = true;
  }
});

function drawLoading() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '30px sans-serif';
    ctx.fillText('Loading Map...', canvas.width / 2 - 100, canvas.height / 2);
  }

function createRandomLevel() {
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
  
    const hole = {
      x: canvasWidth * Math.random(),
      y: canvasHeight * Math.random(),
      radius: 15,
      color: 'black'
    };
    
    const walls = [];
    const numberOfWalls = 20;
    for (let i = 0; i < numberOfWalls; i++) {
      const wallWidth = Math.random() * 150 + 50;
      const wallHeight = Math.random() * 100 + 20;
      const xPos = Math.random() * (canvasWidth - wallWidth);
      const yPos = Math.random() * (canvasHeight - wallHeight);
  
      walls.push({
        x: xPos,
        y: yPos,
        width: wallWidth,
        height: wallHeight
      });
    }
  
    function isPathClear(startX, startY, endX, endY) {
      for (let i = 0; i < walls.length; i++) {
        const wall = walls[i];
        if (isIntersecting(startX, startY, endX, endY, wall)) {
          return false;
        }
      }
      return true;
    }
  
    function isIntersecting(startX, startY, endX, endY, wall) {
      return (
        endX > wall.x && endX < wall.x + wall.width &&
        endY > wall.y && endY < wall.y + wall.height
      );
    }
  
    function checkBallCollisionWithWalls(ball) {
      for (let i = 0; i < walls.length; i++) {
        const wall = walls[i];
        if (
          ball.x + ball.radius > wall.x && ball.x - ball.radius < wall.x + wall.width &&
          ball.y + ball.radius > wall.y && ball.y - ball.radius < wall.y + wall.height
        ) {
          handleBallCollision(ball, wall);
          return true; 
        }
      }
      return false;
    }
  
    function handleBallCollision(ball, wall) {
      
      if (ball.x + ball.radius > wall.x && ball.x - ball.radius < wall.x + wall.width) {
        ball.vx = -ball.vx;
      }
  
      if (ball.y + ball.radius > wall.y && ball.y - ball.radius < wall.y + wall.height) {
        ball.vy = -ball.vy;
      }
    }
  
    const startX = canvasWidth * Math.random();
    const startY = canvasHeight * Math.random();
  
    const isLevelComplete = isPathClear(startX, startY, hole.x, hole.y);
    if (!isLevelComplete) {
        return createRandomLevel(); 
    }
  
    const ball = {
      x: startX,
      y: startY,
      radius: 10,
      color: 'white',
      vx: 0,
      vy: 0,
      moving: false
    };
  
    function moveBall() {
      if (ball.moving) {
        ball.x += ball.vx;
        ball.y += ball.vy;
  
        ball.vx *= 0.98;
        ball.vy *= 0.98;
  
        if (Math.hypot(ball.vx, ball.vy) < 0.1) {
          ball.vx = 0;
          ball.vy = 0;
          ball.moving = false;
        }
      }
    }
  
    function checkCollisionsAndMove() {
      moveBall();
    }
  
    return { walls, hole, ball };
  }  

let aiming = false;
let startX = 0;
let startY = 0;
let mouseX = 0;
let mouseY = 0;

canvas.addEventListener('mousedown', (e) => {
  if (!ball.moving) {
    aiming = true;
    startX = e.clientX;
    startY = e.clientY;
  }
});

canvas.addEventListener('mousemove', function(e) {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

canvas.addEventListener('mouseup', (e) => {
    if (aiming) {
      aiming = false;
      const dx = ball.x - e.clientX;
      const dy = ball.y - e.clientY;
      ball.vx = dx * 0.05;
      ball.vy = dy * 0.05;
      ball.moving = true;
  
      socket.send(JSON.stringify({
        type: 'move',
        x: ball.x,
        y: ball.y,
        vx: ball.vx,
        vy: ball.vy
      }));
    }
  });  

function update() {
    if (ball.moving && !waiting) {
      ball.x += ball.vx;
      ball.y += ball.vy;
  
      ball.vx *= 0.98;
      ball.vy *= 0.98;

      socket.send(JSON.stringify({
        type: 'move',
        x: ball.x,
        y: ball.y,
        vx: ball.vx,
        vy: ball.vy,
        color: ball.color
      }));
  
      for (const wall of walls) {
        if (
          ball.x + ball.radius > wall.x &&
          ball.x - ball.radius < wall.x + wall.width &&
          ball.y + ball.radius > wall.y &&
          ball.y - ball.radius < wall.y + wall.height
        ) {
          const overlapX = Math.min(
            ball.x + ball.radius - wall.x,
            wall.x + wall.width - (ball.x - ball.radius)
          );
          const overlapY = Math.min(
            ball.y + ball.radius - wall.y,
            wall.y + wall.height - (ball.y - ball.radius)
          );
  
          if (overlapX < overlapY) {
            ball.vx = -ball.vx; 
            if (ball.x < wall.x) {
              ball.x = wall.x - ball.radius;
            } else {
              ball.x = wall.x + wall.width + ball.radius;
            }
          } else {
            ball.vy = -ball.vy;
            if (ball.y < wall.y) {
              ball.y = wall.y - ball.radius;
            } else {
              ball.y = wall.y + wall.height + ball.radius;
            }
          }
        }
      }
  
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx = -ball.vx;
      }
      if (ball.x + ball.radius > canvas.width) {
        ball.x = canvas.width - ball.radius;
        ball.vx = -ball.vx;
      }
      if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.vy = -ball.vy;
      }
      if (ball.y + ball.radius > canvas.height) {
        ball.y = canvas.height - ball.radius;
        ball.vy = -ball.vy;
      }
  
      if (Math.hypot(ball.vx, ball.vy) < 0.1) {
        ball.vx = 0;
        ball.vy = 0;
        ball.moving = false;
      }
    }
  
    const dist = Math.hypot(ball.x - hole.x, ball.y - hole.y);
    if (!finished && Math.hypot(ball.x - hole.x, ball.y - hole.y) < hole.radius + 1) {
      finished = true;
      socket.send(JSON.stringify({ type: 'finished' }));
    }
  }

function resetBall() {
  ball.x = canvas.width / 4;
  ball.y = canvas.height / 2;
  ball.vx = 0;
  ball.vy = 0;
  ball.moving = false;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (waiting) {
      ctx.fillStyle = 'white';
      ctx.font = '30px sans-serif';
      ctx.fillText('Waiting for players...', canvas.width / 2 - 100, canvas.height / 2);
      return;
    }

    ctx.fillStyle = hole.color;
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
    ctx.fill();

    const flagpoleHeight = 100;
    const flagpoleWidth = 10;
    
    const gradient = ctx.createLinearGradient(
      hole.x - flagpoleWidth / 2, hole.y - hole.radius - flagpoleHeight - 35,
      hole.x - flagpoleWidth / 2, hole.y - hole.radius - flagpoleHeight - 35 + flagpoleHeight + 37
    );
    
    gradient.addColorStop(0.9, '#fafafa');
    gradient.addColorStop(1, 'black');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(hole.x - flagpoleWidth / 2, hole.y - hole.radius - flagpoleHeight - 35, flagpoleWidth, flagpoleHeight + 37 + hole.radius);

    const flagWidth = 50;
    const flagHeight = 30;
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(hole.x + flagpoleWidth / 2, hole.y - hole.radius - flagpoleHeight);
    ctx.lineTo(hole.x + flagpoleWidth / 2 + flagWidth, hole.y - hole.radius - (flagpoleHeight + 13));
    ctx.lineTo(hole.x + flagpoleWidth / 2, hole.y - hole.radius - flagpoleHeight - flagHeight);
    ctx.closePath();
    ctx.fill();

    for (const id in otherPlayers) {
        const p = otherPlayers[id];
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
      }

    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();     

    for (const wall of walls) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(wall.x + 5, wall.y + 5, wall.width, wall.height);
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    }
  
    if (aiming) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x * 2 - mouseX, ball.y * 2 - mouseY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }  

  function loop() {
    if (mapLoaded) {
      update();
      draw();
    } else {
      drawLoading();
    }
    requestAnimationFrame(loop);
  }

loop();
