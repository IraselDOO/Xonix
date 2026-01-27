/**
 * XONIX NEON - Pure Swipe & Landscape Mode
 */

const CONFIG = {
    COLS: 60, // Wide for landscape
    ROWS: 40,
    FPS: 60,
    MOVE_SPEED: 2,
    COLORS: {
        LAND: '#1e1e3f',
        SEA: '#000',
        TRAIL: '#00ffca',
        PLAYER: '#00ffca',
        ENEMY: '#ff3e3e',
    }
};

const CELL_TYPES = { SEA: 0, LAND: 1, TRAIL: 2 };

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.grid = [];
        this.player = { x: 0, y: 0, dx: 0, dy: 0, nextDx: 0, nextDy: 0 };
        this.enemies = [];
        this.frameCounter = 0;

        this.lives = 3;
        this.score = 0;
        this.targetArea = 75;
        this.currentAreaPercent = 0;
        this.isGameOver = false;

        this.touchStart = { x: 0, y: 0 };
        this.minSwipeDist = 20; // Lowered for more sensitivity

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => {
            // Delay resize slightly to handle rotation transitions
            setTimeout(() => this.resize(), 100);
        });
        this.initEventListeners();
        this.initLevel();
        this.gameLoop();
    }

    resize() {
        const container = document.getElementById('screen-container');
        const cw = container.clientWidth;
        const ch = container.clientHeight;

        const aspect = CONFIG.COLS / CONFIG.ROWS;
        let finalW, finalH;

        if (cw / ch > aspect) {
            finalH = ch;
            finalW = ch * aspect;
        } else {
            finalW = cw;
            finalH = cw / aspect;
        }

        this.canvas.width = finalW;
        this.canvas.height = finalH;
        this.cs = finalW / CONFIG.COLS;
    }

    initLevel() {
        this.grid = [];
        for (let y = 0; y < CONFIG.ROWS; y++) {
            this.grid[y] = [];
            for (let x = 0; x < CONFIG.COLS; x++) {
                const isBorder = x < 2 || x >= CONFIG.COLS - 2 || y < 2 || y >= CONFIG.ROWS - 2;
                this.grid[y][x] = isBorder ? CELL_TYPES.LAND : CELL_TYPES.SEA;
            }
        }
        this.player = { x: 0, y: 0, dx: 0, dy: 0, nextDx: 0, nextDy: 0 };
        this.enemies = [];
        const enemyCount = 1 + Math.floor(this.score / 2000);
        for (let i = 0; i < enemyCount; i++) {
            this.enemies.push({
                x: (CONFIG.COLS / 2) * this.cs,
                y: (CONFIG.ROWS / 2) * this.cs,
                dx: (Math.random() > 0.5 ? 2.5 : -2.5),
                dy: (Math.random() > 0.5 ? 2.5 : -2.5)
            });
        }
        this.calculateArea();
        this.updateStats();
    }

    initEventListeners() {
        window.addEventListener('keydown', (e) => this.handleInput(e.key.toLowerCase()));

        // Global Swipe Surface (the whole wrapper)
        const surface = document.getElementById('game-wrapper');

        surface.addEventListener('touchstart', (e) => {
            this.touchStart.x = e.touches[0].clientX;
            this.touchStart.y = e.touches[0].clientY;
        }, { passive: false });

        surface.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

        surface.addEventListener('touchend', (e) => {
            const touchEnd = {
                x: e.changedTouches[0].clientX,
                y: e.changedTouches[0].clientY
            };
            this.handleSwipe(touchEnd);
        }, { passive: false });

        document.getElementById('restart-btn').addEventListener('click', () => {
            this.score = 0; this.lives = 3; this.isGameOver = false;
            document.getElementById('overlay').classList.add('hidden');
            this.initLevel();
        });
    }

    handleSwipe(end) {
        let dx = end.x - this.touchStart.x;
        let dy = end.y - this.touchStart.y;

        // Correct for 90deg rotation if in portrait mobile
        if (window.innerHeight > window.innerWidth && window.innerWidth < 600) {
            // Swap and invert because of CSS rotation
            const temp = dx;
            dx = dy;
            dy = -temp;
        }

        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (Math.max(absX, absY) > this.minSwipeDist) {
            if (absX > absY) {
                this.handleInput(dx > 0 ? 'right' : 'left');
            } else {
                this.handleInput(dy > 0 ? 'down' : 'up');
            }
        } else {
            this.handleInput('stop');
        }
    }

    handleInput(key) {
        let nextDx = 0, nextDy = 0;
        switch (key) {
            case 'arrowup': case 'w': case 'up': nextDx = 0; nextDy = -1; break;
            case 'arrowdown': case 's': case 'down': nextDx = 0; nextDy = 1; break;
            case 'arrowleft': case 'a': case 'left': nextDx = -1; nextDy = 0; break;
            case 'arrowright': case 'd': case 'right': nextDx = 1; nextDy = 0; break;
            case 'stop': case ' ':
                if (this.grid[this.player.y][this.player.x] === CELL_TYPES.LAND) {
                    this.player.nextDx = 0; this.player.nextDy = 0;
                }
                return;
            default: return;
        }

        if (this.player.dx === -nextDx && this.player.dy === -nextDy && (nextDx !== 0 || nextDy !== 0)) {
            this.player.nextDx = 0; this.player.nextDy = 0;
        } else {
            this.player.nextDx = nextDx;
            this.player.nextDy = nextDy;
        }
    }

    update() {
        if (this.isGameOver) return;
        this.frameCounter++;

        if (this.frameCounter % CONFIG.MOVE_SPEED === 0) {
            this.player.dx = this.player.nextDx;
            this.player.dy = this.player.nextDy;

            const nextX = this.player.x + this.player.dx;
            const nextY = this.player.y + this.player.dy;

            if (nextX >= 0 && nextX < CONFIG.COLS && nextY >= 0 && nextY < CONFIG.ROWS) {
                const nextCell = this.grid[nextY][nextX];
                if (nextCell === CELL_TYPES.SEA) {
                    this.grid[this.player.y][this.player.x] = (this.grid[this.player.y][this.player.x] === CELL_TYPES.LAND) ? CELL_TYPES.LAND : CELL_TYPES.TRAIL;
                    this.player.x = nextX; this.player.y = nextY;
                    this.grid[this.player.y][this.player.x] = CELL_TYPES.TRAIL;
                } else if (nextCell === CELL_TYPES.TRAIL) {
                    this.handleDeath();
                } else if (nextCell === CELL_TYPES.LAND) {
                    if (this.hasTrail()) this.captureArea();
                    this.player.x = nextX; this.player.y = nextY;
                }
            } else {
                if (this.grid[this.player.y][this.player.x] === CELL_TYPES.LAND) {
                    this.player.dx = 0; this.player.dy = 0;
                    this.player.nextDx = 0; this.player.nextDy = 0;
                }
            }
        }

        this.enemies.forEach(e => {
            const nextX = e.x + e.dx;
            const nextY = e.y + e.dy;
            const gx = Math.floor(nextX / this.cs), gy = Math.floor(nextY / this.cs);

            if (gx < 0 || gx >= CONFIG.COLS || (this.grid[Math.floor(e.y / this.cs)] && this.grid[Math.floor(e.y / this.cs)][gx] === CELL_TYPES.LAND)) e.dx *= -1;
            if (gy < 0 || gy >= CONFIG.ROWS || (this.grid[gy] && this.grid[gy][Math.floor(e.x / this.cs)] === CELL_TYPES.LAND)) e.dy *= -1;

            if (this.grid[gy] && this.grid[gy][gx] === CELL_TYPES.TRAIL) this.handleDeath();
            e.x += e.dx; e.y += e.dy;
        });
    }

    hasTrail() {
        for (let row of this.grid) for (let c of row) if (c === CELL_TYPES.TRAIL) return true;
        return false;
    }

    handleDeath() {
        this.lives--;
        for (let y = 0; y < CONFIG.ROWS; y++) for (let x = 0; x < CONFIG.COLS; x++) if (this.grid[y][x] === CELL_TYPES.TRAIL) this.grid[y][x] = CELL_TYPES.SEA;
        this.player = { x: 0, y: 0, dx: 0, dy: 0, nextDx: 0, nextDy: 0 };
        this.updateStats();
        if (this.lives <= 0) this.gameOver();
    }

    captureArea() {
        for (let y = 0; y < CONFIG.ROWS; y++) for (let x = 0; x < CONFIG.COLS; x++) if (this.grid[y][x] === CELL_TYPES.TRAIL) this.grid[y][x] = CELL_TYPES.LAND;

        const mask = this.grid.map(row => row.map(c => c === CELL_TYPES.SEA));
        this.enemies.forEach(e => this.floodFill(mask, Math.floor(e.x / this.cs), Math.floor(e.y / this.cs)));

        for (let y = 0; y < CONFIG.ROWS; y++) {
            for (let x = 0; x < CONFIG.COLS; x++) {
                if (this.grid[y][x] === CELL_TYPES.SEA && mask[y][x]) {
                    this.grid[y][x] = CELL_TYPES.LAND;
                    this.score += 10;
                }
            }
        }
        this.calculateArea(); this.updateStats();
        if (this.currentAreaPercent >= this.targetArea) this.initLevel();
    }

    floodFill(mask, x, y) {
        const stack = [[x, y]];
        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            if (cx < 0 || cx >= CONFIG.COLS || cy < 0 || cy >= CONFIG.ROWS) continue;
            if (!mask[cy][cx]) continue;
            mask[cy][cx] = false;
            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
    }

    calculateArea() {
        let total = CONFIG.COLS * CONFIG.ROWS, land = 0;
        for (let row of this.grid) for (let c of row) if (c === CELL_TYPES.LAND) land++;
        this.currentAreaPercent = Math.floor((land / total) * 100);
    }

    updateStats() {
        document.getElementById('area-percent').textContent = this.currentAreaPercent;
        document.getElementById('lives-count').textContent = this.lives;
        document.getElementById('score-val').textContent = String(this.score).padStart(6, '0');
    }

    gameOver() {
        this.isGameOver = true;
        document.getElementById('overlay').classList.remove('hidden');
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const cs = this.cs;

        this.ctx.fillStyle = CONFIG.COLORS.LAND;
        this.ctx.strokeStyle = '#2a2a5a';
        for (let y = 0; y < CONFIG.ROWS; y++) {
            for (let x = 0; x < CONFIG.COLS; x++) {
                if (this.grid[y][x] === CELL_TYPES.LAND) {
                    this.ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
                    this.ctx.strokeRect(x * cs, y * cs, cs, cs);
                }
            }
        }

        this.ctx.shadowBlur = 10; this.ctx.shadowColor = CONFIG.COLORS.TRAIL;
        this.ctx.fillStyle = CONFIG.COLORS.TRAIL;
        for (let y = 0; y < CONFIG.ROWS; y++) for (let x = 0; x < CONFIG.COLS; x++) if (this.grid[y][x] === CELL_TYPES.TRAIL) this.ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);

        const px = this.player.x * cs, py = this.player.y * cs;
        this.ctx.fillRect(px, py, cs, cs);
        this.ctx.fillStyle = '#000'; this.ctx.shadowBlur = 0;
        this.ctx.fillRect(px + cs * 0.2, py + cs * 0.3, cs * 0.2, cs * 0.2);
        this.ctx.fillRect(px + cs * 0.6, py + cs * 0.3, cs * 0.2, cs * 0.2);

        this.ctx.fillStyle = CONFIG.COLORS.ENEMY; this.ctx.shadowBlur = 15; this.ctx.shadowColor = CONFIG.COLORS.ENEMY;
        this.enemies.forEach(e => {
            this.ctx.beginPath();
            this.ctx.moveTo(e.x + cs / 2, e.y);
            this.ctx.lineTo(e.x + cs, e.y + cs);
            this.ctx.lineTo(e.x, e.y + cs);
            this.ctx.closePath(); this.ctx.fill();
        });
        this.ctx.shadowBlur = 0;
    }

    gameLoop() {
        this.update(); this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

window.onload = () => new Game();
