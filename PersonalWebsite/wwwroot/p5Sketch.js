let canvasWidth, canvasHeight, groundY;
let currentAgentIndex = 0;
let agents = [];
let offsetX = 0;

let Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Constraint = Matter.Constraint;

let engine;
let ground;
let limbA, limbB, muscle;

let sketch = function (p) {
    let lastMuscleUpdate = 0;
    let muscleUpdateInterval = 1000; // Update every 100 ms
    p.setup = function () {
        p.createCanvas(canvasWidth, canvasHeight);
        setupMatterEngine(); // Initialize the Matter.js engine
    };

    p.draw = function () {
        p.background(200);

        let leadingAgent = getLeadingAgent();
        if (leadingAgent) {
            offsetX = p.width / 4 - leadingAgent.centerBody.position.x;  // Center the leading agent on the canvas

            // Scrolling background
            p.fill(100);  // Grey color for the rectangle
            let rectWidth = 30;  // Width of the rectangle
            let rectSpacing = 400;  // Space between rectangles
            let numRects = Math.ceil(canvasWidth / rectSpacing) + 2;  // Number of rectangles to cover the canvas + extras for scrolling
            for (let i = 0; i < numRects; i++) {
                let xPosition = i * rectSpacing + (offsetX % rectSpacing);
                p.rect(xPosition, groundY - 50, rectWidth, 40);  // Drawing the rectangle slightly above the ground
            }


            // Render stage with offset
            p.stroke(50);
            // Looping ground
            let groundSpacing = 100;  // Space between ground lines
            let numGroundLines = Math.ceil(canvasWidth / groundSpacing) + 2;  // Number of lines to cover the canvas + extras for scrolling
            for (let i = 0; i < numGroundLines; i++) {
                let xPosition = i * groundSpacing + (offsetX % groundSpacing);
                p.line(xPosition, groundY, xPosition + groundSpacing, groundY);
            }

            // Display the score of the leading agent
            let leadingAgentScore = leadingAgent.getScore();
            p.fill(0);  // Black text
            p.textSize(20);  // Font size
            p.text(`Leading Agent Score: ${leadingAgentScore}`, 10, groundY + 30);  // Displaying the score just below the ground


            // Update and render agents with offset
            for (let agent of agents) {
                agent.render(p, offsetX);
            }

            if (p.millis() - p.lastMuscleUpdate > p.muscleUpdateInterval) {
                for (let agent of agents) {
                    agent.updateMuscles();
                }
                lastMuscleUpdate = p.millis();
            }
        }
    };

    p.keyPressed = function () {
        if (p.keyCode === p.RIGHT_ARROW) {
            // Apply a force to the current agent's Matter.js body
            let forceMagnitude = 0.01;
            Body.applyForce(agents[currentAgentIndex].centerBody, { x: agents[currentAgentIndex].centerBody.position.x, y: agents[currentAgentIndex].centerBody.position.y }, { x: forceMagnitude, y: -forceMagnitude });

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
    this.centerBody = Bodies.circle(100, 300, 20);  // Central body
    this.limbs = [];
    this.muscles = [];

    // Angle between each limb
    let angleIncrement = 2 * Math.PI / numLimbs;
    let limbLength = 40;
    let limbWidth = 10;
    let bodyDiameter = this.centerBody.bounds.max.x - this.centerBody.bounds.min.x;
    let bodyRadius = bodyDiameter / 2;
    let distanceFromCenter = bodyRadius + limbLength / 2;   // half the diameter of centerBody + half the length of a limb

    for (let i = 0; i < numLimbs; i++) {
        // Calculate limb position
        let limbX = this.centerBody.position.x + distanceFromCenter * Math.cos(i * angleIncrement);
        let limbY = this.centerBody.position.y + distanceFromCenter * Math.sin(i * angleIncrement);

        // Create the limb
        let limb = Bodies.rectangle(limbX, limbY, limbWidth, limbLength, { angle: i * angleIncrement });
        this.limbs.push(limb);

        // Create an attachment constraint between the central body's boundary and the limb's center
        let attachment = Constraint.create({
            bodyA: this.centerBody,
            pointA: { x: distanceFromCenter * Math.cos(i * angleIncrement), y: distanceFromCenter * Math.sin(i * angleIncrement) },
            bodyB: limb,
            pointB: { x: 0, y: 0 },  // Center of the limb
            stiffness: 1
        });
        this.muscles.push(attachment);

        // Create a muscle constraint between the central body's boundary and the limb's long edge center
        let offset = 10;  // Adjust this value to move the muscle attachment point on the central body
        let muscle = Constraint.create({
            bodyA: this.centerBody,
            pointA: { x: (distanceFromCenter + offset) * Math.cos(i * angleIncrement), y: (distanceFromCenter + offset) * Math.sin(i * angleIncrement) },
            bodyB: limb,
            pointB: { x: limbLength / 2 * Math.sin(i * angleIncrement), y: -limbLength / 2 * Math.cos(i * angleIncrement) },  // Center of the limb's long edge
            stiffness: 0.8,
            length: offset  // This value determines how contracted the muscle is initially
        });
        this.muscles.push(muscle);
    }

    // Add the agent's bodies and constraints to the Matter.js world
    World.add(engine.world, [this.centerBody, ...this.limbs, ...this.muscles]);

    this.getScore = function () {
        this.Score = Math.floor(this.centerBody.position.x / 10);
        return this.Score;  // 1 point for every 10px
    };

    this.updateMuscles = function () {
        for (let muscle of this.muscles) {
            // We target only the muscles, not the attachment constraints, by checking the stiffness
            if (muscle.stiffness < 1) {
                let adjustment = random(-10, 10); // Generate a random value between -1 and 1
                muscle.length += adjustment;
            }
        }
    };

    this.render = function (p, offsetX) {
        p.fill(0, 255, 0);
        p.ellipse(this.centerBody.position.x + offsetX, this.centerBody.position.y, 40, 40);  // Render center body

        for (let limb of this.limbs) {
            p.push();
            p.translate(limb.position.x + offsetX, limb.position.y);
            p.rotate(limb.angle);
            p.rectMode(p.CENTER);
            p.rect(0, 0, 10, 40);  // Render each limb
            p.pop();
        }
    };
}

function initializeAgents(agentProperties) {
    for (let agent of agents) {
        World.remove(engine.world, agent.centerBody);
    }
    agents = [];  // Reset the agents array
    for (let i = 0; i < agentProperties.numAgents; i++) {
        agents.push(new Agent(agentProperties.numLimbs));
    }
    offsetX = 0;
}

function getLeadingAgent() {
    if (agents.length === 0) return null;

    return agents.reduce((leading, agent) =>
        (agent.centerBody.position.x > leading.centerBody.position.x ? agent : leading),
        agents[0]
    );
}

function setupMatterEngine() {
    engine = Engine.create();

    ground = Bodies.rectangle(canvasWidth / 2, groundY + 10, canvasWidth * 1000, 20, { isStatic: true });
    World.add(engine.world, [ground]);

    Engine.run(engine);
}

//Not using this reset, I call initializeAgents from C# to reset
window.resetSimulation = function () {
    // Remove all existing agents from Matter world
    for (let agent of agents) {
        World.remove(engine.world, agent.centerBody);
    }

    // Reinitialize agents
    initializeAgents({ numAgents: 3, numLimbs: 2 }); // This is just a placeholder. You'd call this with actual properties from C#.
}
