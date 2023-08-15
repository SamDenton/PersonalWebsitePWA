let canvasWidth, canvasHeight, groundY;
let currentAgentIndex = 0;
let agents = [];

let sketch = function (p) {
    p.setup = function () {
        p.createCanvas(canvasWidth, canvasHeight);
    };

    p.draw = function () {
        p.background(200);

        // Render stage
        p.stroke(50);
        p.line(0, groundY, canvasWidth, groundY);

        // Update and render agents
        for (let agent of agents) {
            agent.update();  // Apply the physics
            agent.render(p);
        }
    };

    p.keyPressed = function () {
        if (p.keyCode === p.RIGHT_ARROW) {
            // Apply positive velocities to the current agent
            agents[currentAgentIndex].VelocityX += currentAgentIndex + 1;  // Example value, adjust as needed
            agents[currentAgentIndex].VelocityY -= currentAgentIndex + 1;  // Negative because up is negative in y-direction

            // Move to the next agent, loop back to the first agent if at the end
            currentAgentIndex = (currentAgentIndex + 1) % agents.length;
        }
    };
};

function initializeSketch(width, height, groundYPosition) {
    canvasWidth = width;
    canvasHeight = height;
    groundY = groundYPosition;
    new p5(sketch, 'canvas-container');
}

function Agent(numLimbs) {
    this.numLimbs = numLimbs;
    this.x = 100;  // Starting position
    this.y = 300;  // Starting position on the ground
    this.VelocityX = 0;
    this.VelocityY = 0;
    this.AccelerationX = 0;
    this.AccelerationY = 0;
    this.Score = 0;
    this.gravity = 0.4;
    this.friction = 0.9;

    this.update = function () {
        this.VelocityY += this.gravity;

        if (this.y >= groundY) {
            this.VelocityX *= this.friction;
        }

        this.x += this.VelocityX;
        this.y += this.VelocityY;

        if (this.y > groundY - 10) {
            this.y = groundY - 10;
            this.VelocityY *= -0.7; 
        }
    };

    // Render function to display the agent on canvas
    this.render = function (p) {
        p.fill(0, 255, 0);
        p.ellipse(this.x, this.y, 20, 20);  // Represent the agent as a circle for now
        // Logic to render limbs can be added later
    };
}

function initializeAgents(agentProperties) {
    agents = [];  // Reset the agents array
    for (let i = 0; i < agentProperties.numAgents; i++) {
        agents.push(new Agent(agentProperties.numLimbs));
    }
}
