/**
 * XONIX NEON - Advanced Performance & Classic Mechanics (Smooth Edition)
 */

const CONFIG = {
    COLS: 80,
    ROWS: 60, // Restored 60 for better play area
    FPS: 60,
    BASE_SPEED: 2, // Tick rate (lower is faster)
    TIME_LIMIT: 99,
    COLORS: {
        LAND: '#101035',
        LAND_BORDER: '#1e1e60',
        SEA: '#000000',
        TRAIL: '#00f2ff',
        PLAYER: '#00f2ff',
        ENEMY_SEA: '#ff3131',
        ENEMY_LAND: '#ff00ff',
    }
};

const CELL_TYPES = { SEA: 0, LAND: 1, TRAIL: 2 };

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.grid = [];
        this.player = { x: 0, y: 0, dx: 0, dy: 0 };
        this.nextDirection = null;

        this.seaEnemies = [];
        this.landEnemies = [];
        this.frameCounter = 0;

        this.level = 1;
        this.lives = 3;
        this.score = 0;
        this.targetArea = 75;
        this.currentAreaPercent = 0;
        this.timeLeft = CONFIG.TIME_LIMIT;
        this.isGameOver = false;

        this.touchStart = { x: 0, y: 0 };
        this.minSwipeDist = 15;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => {
            setTimeout(() => this.resize(), 150);
        });
        this.initEventListeners();
        this.initLevel();
        this.gameLoop();
    }

    resize() {
        const container = document.getElementById('screen-container');
        if (!container) return;

        const containerW = container.clientWidth;
        const containerH = container.clientHeight;

        const targetAspect = CONFIG.COLS / CONFIG.ROWS;
        let finalW, finalH;

        if (containerW / containerH > targetAspect) {
            finalH = containerH * 0.95;
            finalW = finalH * targetAspect;
        } else {
            finalW = containerW * 0.95;
            finalH = finalW / targetAspect;
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

        this.player = { x: 0, y: 0, dx: 0, dy: 0 };
        this.nextDirection = null;

        // Sea Enemies - Pixel based for smoothness
        this.seaEnemies = [];
        const seaEnemyCount = 1 + this.level;
        for (let i = 0; i < seaEnemyCount; i++) {
            this.seaEnemies.push({
                x: (CONFIG.COLS / 2) * this.cs,
                y: (CONFIG.ROWS / 2) * this.cs,
                dx: (Math.random() > 0.5 ? 2 : -2),
                dy: (Math.random() > 0.5 ? 2 : -2)
            });
        }

        // Land Enemies (Sparkies)
        this.landEnemies = [];
        if (this.level >= 3) {
            const landEnemyCount = this.level >= 6 ? 2 : 1;
            for (let i = 0; i < landEnemyCount; i++) {
                this.landEnemies.push({
                    gx: 0,
                    gy: 0,
                    dx: 1,
                    dy: 0
                });
            }
        }

        this.timeLeft = CONFIG.TIME_LIMIT;
        this.calculateArea();
        this.updateStats();
    }

    initEventListeners() {
        window.addEventListener('keydown', (e) => this.handleInput(e.key.toLowerCase()));

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
            this.score = 0;
            this.lives = 3;
            this.level = 1;
            this.isGameOver = false;
            document.getElementById('overlay').classList.add('hidden');
            this.initLevel();
        });
    }

    handleSwipe(end) {
        let dx = end.x - this.touchStart.x;
        let dy = end.y - this.touchStart.y;

        if (window.innerHeight > window.innerWidth && window.innerWidth < 600) {
            const temp = dx;
            dx = dy;
            dy = -temp;
        }

        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (Math.max(absX, absY) > this.minSwipeDist) {
            if (absX > absY) {
                this.nextDirection = dx > 0 ? { dx: 1, dy: 0 } : { dx: -1, dy: 0 };
            } else {
                this.nextDirection = dy > 0 ? { dx: 0, dy: 1 } : { dx: 0, dy: -1 };
            }
        }
    }

    handleInput(key) {
        switch (key) {
            case 'arrowup': case 'w': this.nextDirection = { dx: 0, dy: -1 }; break;
            case 'arrowdown': case 's': this.nextDirection = { dx: 0, dy: 1 }; break;
            case 'arrowleft': case 'a': this.nextDirection = { dx: -1, dy: 0 }; break;
            case 'arrowright': case 'd': this.nextDirection = { dx: 1, dy: 0 }; break;
            case ' ':
                if (this.grid[this.player.y][this.player.x] === CELL_TYPES.LAND) {
                    this.player.dx = 0; this.player.dy = 0;
                    this.nextDirection = null;
                }
                break;
        }
    }

    update() {
        if (this.isGameOver) return;
        this.frameCounter++;

        // Speed increases slightly every 5 levels
        const speedFactor = 1 + Math.floor((this.level - 1) / 5) * 0.1;

        // Player movement is cell-based for precision (1984 requirement)
        if (this.frameCounter % CONFIG.BASE_SPEED === 0) {
            if (this.frameCounter % CONFIG.FPS === 0) {
                this.timeLeft--;
                if (this.timeLeft <= 0) this.handleDeath();
                this.updateStats();
            }

            if (this.nextDirection) {
                const is180 = (this.player.dx === -this.nextDirection.dx && this.player.dx !== 0) ||
                    (this.player.dy === -this.nextDirection.dy && this.player.dy !== 0);

                if (!is180 || this.grid[this.player.y][this.player.x] === CELL_TYPES.LAND) {
                    this.player.dx = this.nextDirection.dx;
                    this.player.dy = this.nextDirection.dy;
                    this.nextDirection = null;
                }
            }

            const nextX = this.player.x + this.player.dx;
            const nextY = this.player.y + this.player.dy;

            if (nextX >= 0 && nextX < CONFIG.COLS && nextY >= 0 && nextY < CONFIG.ROWS) {
                const nextCell = this.grid[nextY][nextX];

                if (nextCell === CELL_TYPES.TRAIL && (this.player.dx !== 0 || this.player.dy !== 0)) {
                    this.handleDeath();
                    return;
                }

                if (nextCell === CELL_TYPES.SEA) {
                    this.grid[this.player.y][this.player.x] = (this.grid[this.player.y][this.player.x] === CELL_TYPES.LAND) ? CELL_TYPES.LAND : CELL_TYPES.TRAIL;
                    this.player.x = nextX; this.player.y = nextY;
                    this.grid[this.player.y][this.player.x] = CELL_TYPES.TRAIL;
                } else if (nextCell === CELL_TYPES.LAND) {
                    if (this.hasTrail()) {
                        this.captureArea();
                        this.player.dx = 0; this.player.dy = 0;
                        this.nextDirection = null;
                    }
                    this.player.x = nextX; this.player.y = nextY;
                }
            } else {
                this.player.dx = 0; this.player.dy = 0;
            }

            // Move Sparkies (Land Enemies) - Grid based for precision
            this.landEnemies.forEach(e => {
                let moved = false;
                const nextX = e.gx + e.dx;
                const nextY = e.gy + e.dy;

                if (this.grid[nextY] && this.grid[nextY][nextX] === CELL_TYPES.LAND) {
                    e.gx = nextX; e.gy = nextY;
                    moved = true;
                }

                if (!moved) {
                    const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }].sort(() => Math.random() - 0.5);
                    for (let d of dirs) {
                        const nx = e.gx + d.dx, ny = e.gy + d.dy;
                        if (this.grid[ny] && this.grid[ny][nx] === CELL_TYPES.LAND && (d.dx !== -e.dx || d.dy !== -e.dy)) {
                            e.dx = d.dx; e.dy = d.dy;
                            e.gx = nx; e.gy = ny;
                            moved = true;
                            break;
                        }
                    }
                }
                if (e.gx === this.player.x && e.gy === this.player.y) this.handleDeath();
            });
        }

        // Sea Enemies - Smooth Pixel Movement
        const cs = this.cs;
        const enemySpeed = 2 * speedFactor;
        this.seaEnemies.forEach(e => {
            const nextX = e.x + e.dx * enemySpeed;
            const nextY = e.y + e.dy * enemySpeed;

            // Simple bouncing logic
            const gx = Math.floor(nextX / cs), gy = Math.floor(nextY / cs);
            const curGX = Math.floor(e.x / cs), curGY = Math.floor(e.y / cs);

            // Bounds / Land collision
            if (gx < 0 || gx >= CONFIG.COLS || (this.grid[curGY] && this.grid[curGY][gx] === CELL_TYPES.LAND)) e.dx *= -1;
            if (gy < 0 || gy >= CONFIG.ROWS || (this.grid[gy] && this.grid[gy][curGX] === CELL_TYPES.LAND)) e.dy *= -1;

            e.x += e.dx * enemySpeed;
            e.y += e.dy * enemySpeed;

            // Hit detection with trail
            const trailGX = Math.floor(e.x / cs), trailGY = Math.floor(e.y / cs);
            if (this.grid[trailGY] && this.grid[trailGY][trailGX] === CELL_TYPES.TRAIL) {
                this.handleDeath();
            }
        });
    }

    hasTrail() {
        for (let row of this.grid) for (let c of row) if (c === CELL_TYPES.TRAIL) return true;
        return false;
    }

    handleDeath() {
        this.lives--;
        for (let y = 0; y < CONFIG.ROWS; y++) for (let x = 0; x < CONFIG.COLS; x++) if (this.grid[y][x] === CELL_TYPES.TRAIL) this.grid[y][x] = CELL_TYPES.SEA;
        this.player = { x: 0, y: 0, dx: 0, dy: 0 };
        this.nextDirection = null;
        this.updateStats();
        if (this.lives <= 0) this.gameOver();
    }

    captureArea() {
        for (let y = 0; y < CONFIG.ROWS; y++) for (let x = 0; x < CONFIG.COLS; x++) if (this.grid[y][x] === CELL_TYPES.TRAIL) this.grid[y][x] = CELL_TYPES.LAND;

        const mask = this.grid.map(row => row.map(c => c === CELL_TYPES.SEA));
        this.seaEnemies.forEach(e => this.floodFill(mask, Math.floor(e.x / this.cs), Math.floor(e.y / this.cs)));

        let newlyCaptured = 0;
        for (let y = 0; y < CONFIG.ROWS; y++) {
            for (let x = 0; x < CONFIG.COLS; x++) {
                if (this.grid[y][x] === CELL_TYPES.SEA && mask[y][x]) {
                    this.grid[y][x] = CELL_TYPES.LAND; newlyCaptured++;
                }
            }
        }
        this.score += newlyCaptured * 10;
        this.calculateArea(); this.updateStats();

        if (this.currentAreaPercent >= this.targetArea) {
            this.score += this.level * 1000; this.level++; this.initLevel();
        }
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
        const timeEl = document.getElementById('time-left');
        if (timeEl) timeEl.textContent = Math.max(0, this.timeLeft);
    }

    gameOver() {
        this.isGameOver = true;
        document.getElementById('overlay').classList.remove('hidden');
        document.getElementById('status-info').textContent = "FINAL SCORE: " + this.score;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const cs = this.cs;

        // Grid Background
        this.ctx.strokeStyle = 'rgba(0, 242, 255, 0.03)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= CONFIG.COLS; i++) {
            this.ctx.beginPath(); this.ctx.moveTo(i * cs, 0); this.ctx.lineTo(i * cs, this.canvas.height); this.ctx.stroke();
        }
        for (let i = 0; i <= CONFIG.ROWS; i++) {
            this.ctx.beginPath(); this.ctx.moveTo(0, i * cs); this.ctx.lineTo(this.canvas.width, i * cs); this.ctx.stroke();
        }

        // Land
        this.ctx.fillStyle = CONFIG.COLORS.LAND;
        this.ctx.strokeStyle = CONFIG.COLORS.LAND_BORDER;
        for (let y = 0; y < CONFIG.ROWS; y++) {
            for (let x = 0; x < CONFIG.COLS; x++) {
                if (this.grid[y][x] === CELL_TYPES.LAND) this.ctx.fillRect(x * cs, y * cs, cs, cs);
            }
        }

        // Trail & Player
        this.ctx.shadowBlur = 12; this.ctx.shadowColor = CONFIG.COLORS.TRAIL;
        this.ctx.fillStyle = CONFIG.COLORS.TRAIL;
        for (let y = 0; y < CONFIG.ROWS; y++) {
            for (let x = 0; x < CONFIG.COLS; x++) {
                if (this.grid[y][x] === CELL_TYPES.TRAIL) this.ctx.fillRect(x * cs + cs * 0.1, y * cs + cs * 0.1, cs * 0.8, cs * 0.8);
            }
        }

        const px = this.player.x * cs, py = this.player.y * cs;
        this.ctx.fillRect(px, py, cs, cs);
        this.ctx.fillStyle = '#fff'; this.ctx.fillRect(px + cs * 0.2, py + cs * 0.2, cs * 0.6, cs * 0.15);

        // Sea Enemies (Smooth)
        this.ctx.shadowBlur = 15; this.ctx.shadowColor = CONFIG.COLORS.ENEMY_SEA;
        this.ctx.fillStyle = CONFIG.COLORS.ENEMY_SEA;
        this.seaEnemies.forEach(e => {
            this.ctx.beginPath();
            this.ctx.arc(e.x, e.y, cs / 2.5, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Land Enemies (Grid Based)
        this.ctx.shadowBlur = 15; this.ctx.shadowColor = CONFIG.COLORS.ENEMY_LAND;
        this.ctx.fillStyle = CONFIG.COLORS.ENEMY_LAND;
        this.landEnemies.forEach(e => {
            const ex = e.gx * cs, ey = e.gy * cs;
            this.ctx.beginPath();
            this.ctx.moveTo(ex + cs / 2, ey); this.ctx.lineTo(ex + cs, ey + cs / 2);
            this.ctx.lineTo(ex + cs / 2, ey + cs); this.ctx.lineTo(ex, ey + cs / 2);
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
