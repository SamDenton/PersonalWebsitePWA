let canvasWidth, canvasHeight, groundY, GravityStrength, FrictionStrength, renderedAgents, simulationSpeed, popSize, topPerformerNo;
let currentAgentIndex = 0;
let agents = [];
let offsetX = 0;
let p5Instance = null;
let Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Constraint = Matter.Constraint;

let shouldUpdatePhysics = true;
let engine;
let ground;
let limbA, limbB, muscle;
let delay;
let categoryAgent = 0x0001;
let categoryGround = 0x0002;
let MAX_ADJUSTMENT = 1;

let tickCount = 0;
let simulationLength;

let sketch = function (p) {
    let lastMuscleUpdate = 0;
    let muscleUpdateInterval = 1000; // Update every 100 ms

    let fixedTimeStep = 1000 / simulationSpeed; // 60 updates per second for physics
    let accumulator = 0;
    let lastTime = 0;

    p.setup = function () {
        p.createCanvas(canvasWidth, canvasHeight);
        setupMatterEngine(); // Initialize the Matter.js engine
        lastTime = p.millis();
    };

    p.draw = function () {
        if (!shouldUpdatePhysics) return;
        p.background(200);

        let currentTime = p.millis();
        let delta = currentTime - lastTime;
        lastTime = currentTime;

        accumulator += delta;

        while (accumulator >= fixedTimeStep) {
            updatePhysics();
            accumulator -= fixedTimeStep;
        }

        renderScene(p);
    };


    function updatePhysics() {
        let leadingAgent = getLeadingAgent();
        if (leadingAgent) {
            if (p.millis() - lastMuscleUpdate > muscleUpdateInterval) {
                for (let agent of agents) {
                    agent.updateMuscles();
                }
                lastMuscleUpdate = p.millis();
            }

            for (let agent of agents) {
                let inputs = agent.collectInputs();
                agent.makeDecision(inputs);
            }

            // Run the Matter.JS engine
            Engine.update(engine);

            // Logic to end the simulation after set number of frames
            tickCount++;
            if (tickCount >= simulationLength) {
                endSimulation(p);
            }
        }
    }

    function renderScene(p) {

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


            agents.sort((a, b) => b.getScore() - a.getScore());  // Sorts the agents in descending order based on score
            let leadingAgents = agents.slice(0, renderedAgents);
            for (let agent of agents) {
                if (leadingAgents.includes(agent)) {
                    agent.render(p, offsetX);
                }
            }

            // Display frame rate
            p.fill(255);  // White color for the text
            p.textSize(18);  // Font size
            p.text(`FPS: ${p.round(p.frameRate())}`, 10, 20);  // Displaying the frame rate at the top-left corner

            // Render NN for leading agent
            leadingAgent.renderNN(p, canvasWidth - 500, (canvasHeight / 2) - 100);
        }
    };
};

function initializeSketch(width, height, groundYPosition, gravityStrength, frictionStrength, simLength, renderedAgentsNo, simSpeed, topPerformerNumber) {
    canvasWidth = width;
    canvasHeight = height;
    groundY = groundYPosition;
    GravityStrength = gravityStrength;
    FrictionStrength = frictionStrength;
    simulationLength = simLength;
    renderedAgents = renderedAgentsNo;
    simulationSpeed = simSpeed;
    topPerformerNo = topPerformerNumber;

    // If there are existing agents with models, dispose of them
    for (let agent of agents) {
        if (agent.brain) {
            agent.brain.dispose();
        }
    }

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
    let color1 = Math.floor(Math.random() * 256);
    let color2 = Math.floor(Math.random() * 256);
    let color3 = Math.floor(Math.random() * 256);
    this.centerBody = Bodies.circle(100, 300, 20, {
        friction: FrictionStrength,
        collisionFilter: {
            category: categoryAgent,
            mask: categoryGround  // This means the agent will only collide with the ground
        }
    });  // Central body

    this.limbs = [];
    this.muscles = [];
    this.joints = [];

    let angleIncrement = 2 * Math.PI / numLimbs;
    let limbLength = 40;
    let limbWidth = 10;
    let bodyDiameter = this.centerBody.bounds.max.x - this.centerBody.bounds.min.x;
    let bodyRadius = bodyDiameter / 2;
    let distanceFromCenter = bodyRadius + limbLength / 2;   // half the diameter of centerBody + half the length of a limb

    let nnConfig;

    for (let i = 0; i < numLimbs; i++) {
        // Calculate limb position
        let limbX = this.centerBody.position.x + distanceFromCenter * Math.cos(i * angleIncrement);
        let limbY = this.centerBody.position.y + distanceFromCenter * Math.sin(i * angleIncrement);

        // Create the limb with 90-degree rotation
        let limb = Bodies.rectangle(limbX, limbY, limbWidth, limbLength, {
            angle: i * angleIncrement + Math.PI / 2,
            friction: FrictionStrength,
            collisionFilter: {
                category: categoryAgent,
                mask: categoryGround
            }
        });
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
        this.joints.push(attachment);

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
    World.add(engine.world, [this.centerBody, ...this.limbs, ...this.muscles, ...this.joints]);

    // Give the agent a brain!
    this.nnConfig = nnConfig || new NeuralNetworkConfig(numLimbs); 
    this.brain = createNeuralNetwork(this.nnConfig);

    this.getScore = function () {
        this.Score = Math.floor(this.centerBody.position.x / 10);
        return this.Score;  // 1 point for every 10px
    };

    this.render = function (p, offsetX) {
        p.fill(color1, color2, color3);
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
    popSize = agentProperties.numAgents;
    limbsPerAgent = agentProperties.numLimbs;
    delay = delay || 50;
    for (let agent of agents) {
        World.remove(engine.world, agent.centerBody);
    }
    agents = [];  // Reset the agents array
    for (let i = 0; i < popSize; i++) {
        setTimeout(() => {
            agents.push(new Agent(limbsPerAgent));
        }, i * delay);
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

function endSimulation(p) {
    shouldUpdatePhysics = false;
    p.noLoop();
    nextGeneration(p);
}

function setupMatterEngine() {
    engine = Engine.create({
        positionIterations: 10,
        velocityIterations: 10
    });
    engine.world.gravity.y = GravityStrength;
    ground = Bodies.rectangle(canvasWidth / 2, groundY + 10, canvasWidth * 1000, 20, {
        isStatic: true,
        collisionFilter: {
            category: categoryGround
        }
    });
    World.add(engine.world, [ground]);
    //Engine.run(engine);
    //engine.enabled = false;
}

/*            Neural Network Functions                     */

function NeuralNetworkConfig(numLimbs) {
    this.inputNodes = numLimbs + 6; // Muscle lengths, agent x,y, agent velosity x,y, score, agent orientation
    this.hiddenLayers = [{ nodes: 10, activation: 'relu' }, { nodes: 5, activation: 'relu' }];
    this.outputNodes = numLimbs;
    this.mutationRate = Math.random();  // A random mutation rate between 0 and 1
    // console.log('Number of tensors:', tf.memory().numTensors);
}

function createNeuralNetwork(config) {
    const model = tf.sequential();
    // console.log(model instanceof tf.Sequential);  // Should log "true"

    // Input layer
    model.add(tf.layers.dense({ units: config.hiddenLayers[0].nodes, activation: config.hiddenLayers[0].activation, inputShape: [config.inputNodes] }));

    // Hidden layers
    for (let i = 0; i < config.hiddenLayers.length; i++) {
        model.add(tf.layers.dense({ units: config.hiddenLayers[i].nodes, activation: config.hiddenLayers[i].activation }));
    }

    // Output layer
    model.add(tf.layers.dense({ units: config.outputNodes, activation: 'sigmoid' }));  // Sigmoid to get values between 0 and 1

    return model;
}

async function nextGeneration(p) {
    let newAgents = [];

    // Keep top 10% agents without changes
    for (let i = 0; i < Math.round(topPerformerNo * popSize); i++) {
        newAgents.push(agents[i]);
    }

    // Generate offspring
    while (newAgents.length < popSize) {
        let parent1 = selectAgent(agents);
        let parent2 = selectAgent(agents);
        let childBrain = await crossover(parent1, parent2);
        // console.log('Child brain after crossover: ' + childBrain);
        let childAgent = new Agent(limbsPerAgent);
        childAgent.brain = childBrain;
        mutate(childAgent, this.mutationRate);
        // console.log('Child brain after mutations: ' + childAgent.brain);
        newAgents.push(childAgent);
    }

    // Dispose old agents and set the new ones
    agents.forEach(agent => {
        if (!newAgents.includes(agent) && agent.brain) {
            agent.brain.dispose();
        }
    });
    agents = newAgents;
    console.log('Restarting simulation with evolved agents!');
    // Reset simulation
    shouldUpdatePhysics = true;
    tickCount = 0;
    p.loop();
}


function selectAgent(agents) {
    let totalFitness = agents.reduce((sum, agent) => sum + agent.getScore(), 0);
    let threshold = Math.random() * totalFitness;
    let sum = 0;
    for (let agent of agents) {
        sum += agent.getScore();
        if (sum > threshold) {
            return agent;
        }
    }
    return agents[agents.length - 1];
}

async function crossover(agent1, agent2) {
    let childBrain = await cloneModel(agent1.brain);

    let agent1Weights = agent1.brain.getWeights();
    let agent2Weights = agent2.brain.getWeights();
    let newWeights = [];

    for (let i = 0; i < agent1Weights.length; i++) {
        let weight1 = agent1Weights[i];
        let weight2 = agent2Weights[i];
        let shape = weight1.shape;
        let values1 = weight1.dataSync();
        let values2 = weight2.dataSync();
        let newValues = [];

        for (let j = 0; j < values1.length; j++) {
            if (Math.random() < 0.5) {
                newValues[j] = values1[j];
            } else {
                newValues[j] = values2[j];
            }
        }

        let newWeight = tf.tensor(newValues, shape);
        newWeights.push(newWeight);
    }

    // Log shapes
    // console.log("New Weights Shapes:", newWeights.map(w => w.shape));

    childBrain.setWeights(newWeights);

    return childBrain;
}



function mutate(agent, mutationRate) {
    function mutateValues(values) {
        for (let i = 0; i < values.length; i++) {
            if (Math.random() < mutationRate) {
                let adjustment = (Math.random() - 0.5) * 0.1;  // Adjust by max +/- 0.05
                values[i] += adjustment;
            }
        }
    }
    // console.log('Child brain after mutation' + agent.brain)
    let weights = agent.brain.getWeights();
    weights.forEach(w => {
        let values = w.arraySync();
        mutateValues(values);
        w.assign(tf.tensor(values));
    });
}

async function cloneModel(model) {
    const modelName = 'temp-model';

    // Save the model to indexedDB
    await model.save(`indexeddb://${modelName}`);

    // Load the model back from indexedDB
    const clonedModel = await tf.loadLayersModel(`indexeddb://${modelName}`);

    // Clean up by removing the model from indexedDB
    await tf.io.removeModel(`indexeddb://${modelName}`);

    return clonedModel;
}


function renderNeuralNetwork(p, nnConfig, agent, offsetX, offsetY) {
    let layerGap = 25; // horizontal space between layers
    let nodeGap = 15;   // vertical space between nodes

    let inputLabels = [
        ...Array(nnConfig.inputNodes - 6).fill(null).map((_, idx) => `Muscle ${idx + 1}`),
        "Agent's X",
        "Agent's Y",
        "Velocity X",
        "Velocity Y",
        "Score",
        "Agent's Orientation"
    ];

    let outputLabels = Array(nnConfig.outputNodes).fill(null).map((_, idx) => `Muscle ${idx + 1}`);

    // Loop through each layer
    let x = offsetX;
    for (let i = 0; i < nnConfig.hiddenLayers.length + 2; i++) { // +2 to account for input and output layers
        let nodes = 0;
        let labels = [];
        if (i === 0) {
            nodes = nnConfig.inputNodes;
            labels = inputLabels;
        } else if (i === nnConfig.hiddenLayers.length + 1) {
            nodes = nnConfig.outputNodes;
            labels = outputLabels;
        } else {
            nodes = nnConfig.hiddenLayers[i - 1].nodes;
        }

        let startY = offsetY - ((nodes - 1) * nodeGap) / 2; // to center the nodes
        for (let j = 0; j < nodes; j++) {
            let y = startY + j * nodeGap;
            p.ellipse(x, y, 10, 10);

            // Add labels to the side of input and output nodes
            if (labels.length > 0) {
                p.textSize(12);
                if (i === 0) {
                    p.text(labels[j], x - 70, y + 4);
                } else if (i === nnConfig.hiddenLayers.length + 1) {
                    p.text(labels[j], x + 15, y + 4);

                    // Display the current muscle length as an indication
                    if (agent) {
                        let muscleLength = agent.muscles[j].length.toFixed(2); // *2 + 1 to get the actual muscle constraints
                        p.text(`Length: ${muscleLength}`, x + 70, y + 4);
                    }
                }
            }
        }
        x += layerGap;
    }
}


Agent.prototype.makeDecision = function (inputs) {
    return tf.tidy(() => {
        const output = this.brain.predict(tf.tensor([inputs])).dataSync();
        for (let i = 0; i < this.muscles.length; i++) {
            // Constraints on moving muscles too far
            let currentMuscle = this.muscles[i];
            if (currentMuscle.length < currentMuscle.originalLength * 1.7 && currentMuscle.length > currentMuscle.originalLength * 0.8) {
                let adjustment = output[i] * MAX_ADJUSTMENT;  // Scales the adjustment based on the output
                this.muscles[i].length += adjustment;
            }
        }
    });
}

Agent.prototype.collectInputs = function () {
    let inputs = [];
    // 1. Muscle lengths
    for (let muscle of this.muscles) {

        // Error alert
        if (isNaN(muscle.length) && muscle.stiffness < 1) {
            alert("Muscle length is NaN!");
        }

        if (muscle.stiffness < 1) {
            inputs.push(muscle.length);
        }
    }

    // 2. Agent's position (x,y)
    inputs.push(this.centerBody.position.x);
    inputs.push(this.centerBody.position.y);

    // 3. Agent's velocity (x,y)
    inputs.push(this.centerBody.velocity.x);
    inputs.push(this.centerBody.velocity.y);

    // 4. Score
    inputs.push(this.getScore());

    // 5. Agent's orientation
    inputs.push(this.centerBody.angle);

    return inputs;
};

Agent.prototype.updateMuscles = function () {
    let inputs = this.collectInputs();
    this.makeDecision(inputs);
    //let outputs = this.makeDecision(inputs);
};

Agent.prototype.renderNN = function (p, offsetX, offsetY) {
    renderNeuralNetwork(p, this.nnConfig, this, offsetX, offsetY);
};