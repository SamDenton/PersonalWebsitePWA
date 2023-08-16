let canvasWidth, canvasHeight, groundY, GravityStrength, FrictionStrength;
let currentAgentIndex = 0;
let agents = [];
let offsetX = 0;
let p5Instance = null;
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

            if (p.millis() - p.lastMuscleUpdate > muscleUpdateInterval) {
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
            //let forceMagnitude = 0.01;
            //Body.applyForce(agents[currentAgentIndex].centerBody, { x: agents[currentAgentIndex].centerBody.position.x, y: agents[currentAgentIndex].centerBody.position.y }, { x: forceMagnitude, y: -forceMagnitude });
            for (let muscle of agents[currentAgentIndex].muscles) {
                // We target only the muscles, not the attachment constraints, by checking the stiffness
                if (muscle.stiffness < 1 && muscle.length < muscle.originalLength * 1.7) {
                    let adjustment = 5;
                    muscle.length += adjustment;
                }
            }
            // Move to the next agent, loop back to the first agent if at the end
            currentAgentIndex = (currentAgentIndex + 1) % agents.length;
        }
        else if (p.keyCode === p.LEFT_ARROW) {
            // Apply a force to the current agent's Matter.js body
            //let forceMagnitude = 0.01;
            //Body.applyForce(agents[currentAgentIndex].centerBody, { x: agents[currentAgentIndex].centerBody.position.x, y: agents[currentAgentIndex].centerBody.position.y }, { x: forceMagnitude, y: -forceMagnitude });
            for (let muscle of agents[currentAgentIndex].muscles) {
                // We target only the muscles, not the attachment constraints, by checking the stiffness
                if (muscle.stiffness < 1 && muscle.length > muscle.originalLength * 0.8) {
                    let adjustment = 5; 
                    muscle.length -= adjustment;
                }
            }
            // Move to the next agent, loop back to the first agent if at the end
            currentAgentIndex = (currentAgentIndex + 1) % agents.length;
        }
    };
};

function initializeSketch(width, height, groundYPosition, gravityStrength, frictionStrength) {
    canvasWidth = width;
    canvasHeight = height;
    groundY = groundYPosition;
    GravityStrength = gravityStrength;
    FrictionStrength = frictionStrength;

    // If there's an existing p5 instance, remove it
    if (p5Instance) {
        p5Instance.remove();
        p5Instance = null;
    }

    // Create a new p5 instance and assign it to the global reference
    p5Instance = new p5(sketch, 'canvas-container');
}
//this agent will do for now, but I intend to replace with with a dynamic body plan that can 'evolve' over time.
//I think a JSON file defining a series of body and limb shapes, possibly with limbs connected to limbs etc
//Starting from a random config, this would not work, as there would be little chance of initial fitness, but starting from a simple body plan and exolving complexity based on randomness and fitness might work.
function Agent(numLimbs) {
    this.numLimbs = numLimbs;
    let categoryAgent = 0x0001;
    let categoryGround = 0x0002;

    this.centerBody = Bodies.circle(100, 300, 20, {
        friction: FrictionStrength,
        collisionFilter: {
            category: categoryAgent,
            mask: categoryGround  // This means the agent will only collide with the ground
        }
    });  // Central body

    this.limbs = [];
    this.muscles = [];

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

        // Create the limb with 90-degree rotation
        let limb = Bodies.rectangle(limbX, limbY, limbWidth, limbLength, { angle: i * angleIncrement + Math.PI / 2 });
        this.limbs.push(limb);

        // Calculate the attachment point
        let attachX = Math.cos(i * angleIncrement) * bodyRadius;
        let attachY = Math.sin(i * angleIncrement) * bodyRadius;

        // Calculate the muscle attachment point
        let adjustedAngle = i * angleIncrement - (angleIncrement / 2);
        let attachMuscleX = Math.cos(adjustedAngle) * bodyRadius;
        let attachMuscleY = Math.sin(adjustedAngle) * bodyRadius;

        // Calculate the muscle length
        let dx = this.centerBody.position.x + attachX - (limb.position.x + limbWidth / 2 * Math.sin(i * angleIncrement));
        let dy = this.centerBody.position.y + attachY - (limb.position.y - limbWidth / 2 * Math.cos(i * angleIncrement));
        let originalLength = Math.sqrt(dx * dx + dy * dy);

        // Create an attachment constraint between the central body's boundary and the limb's edge
        let attachment = Constraint.create({
            bodyA: this.centerBody,
            bodyB: limb,
            pointA: { x: attachX, y: attachY },
            pointB: { x: -limbWidth / 0.5 * Math.cos(i * angleIncrement), y: -limbWidth / 0.5 * Math.sin(i * angleIncrement) },  // Center of the short edge of the limb
            stiffness: 1,
            length: 0
        });
        this.muscles.push(attachment);

        // Muscle constraint
        let muscle = Constraint.create({
            bodyA: this.centerBody,
            bodyB: limb,
            pointA: { x: attachMuscleX, y: attachMuscleY },
            pointB: { x: limbWidth / 2 * Math.sin(i * angleIncrement), y: -limbWidth / 2 * Math.cos(i * angleIncrement) },  // Center of the limb
            stiffness: 0.5,
            originalLength: originalLength 
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
            if (muscle.stiffness < 1 && muscle.length < offset) {
                muscle.length *= 1.1;
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

        // Render the constraints (attachments and muscles)
        for (let constraint of this.muscles) {
            let startPoint = constraint.bodyA.position;
            let endPoint = constraint.bodyB.position;

            // Adjusting for local offsets (attachment points on the bodies)
            let offsetXStart = constraint.pointA.x;
            let offsetYStart = constraint.pointA.y;
            let offsetXEnd = constraint.pointB.x;
            let offsetYEnd = constraint.pointB.y;

            // Check if it's an attachment
            if (constraint.stiffness === 1) {
                p.fill(255, 0, 0);  // Red color for the attachment points
                p.ellipse(startPoint.x + offsetX + offsetXStart, startPoint.y + offsetYStart, 5);  // Small circle
                p.ellipse(endPoint.x + offsetX + offsetXEnd, endPoint.y + offsetYEnd, 5);  // Small circle
            } else {  // It's a muscle
                p.stroke(0, 0, 255);  // Blue color for the muscles
                p.line(startPoint.x + offsetX + offsetXStart, startPoint.y + offsetYStart,
                    endPoint.x + offsetX + offsetXEnd, endPoint.y + offsetYEnd);
            }
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
    engine.world.gravity.y = GravityStrength;
    ground = Bodies.rectangle(canvasWidth / 2, groundY + 10, canvasWidth * 1000, 20, { isStatic: true });
    World.add(engine.world, [ground]);
    Engine.run(engine);
    //engine.enabled = false;
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
