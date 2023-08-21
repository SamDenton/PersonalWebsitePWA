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

let genCount;
let displayedFPS = 0;
let displayedTimeLeft = 0;
let frameCountSinceLastFPS;
let lastFPSCalculationTime;
let tickCount = 0;
let simulationLength;
let lastUIUpdateTime = 0;
let UIUpdateInterval = 500;

let topScoreEver = 0;

let sketch = function (p) {
    let lastMuscleUpdate = 0;
    let muscleUpdateInterval = 1000; // Update every 100 ms

    let fixedTimeStep = 1000 / simulationSpeed; // 'simulationSpeed' updates per second for physics
    let accumulator = 0;
    let lastTime = 0;
    let leadingAgent;

    p.setup = function () {
        p.frameRate(60);
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
        leadingAgent = getLeadingAgent();
        if (leadingAgent) {
            if (p.millis() - lastMuscleUpdate > muscleUpdateInterval) {
                for (let agent of agents) {
                    agent.updateMuscles();
                }
                lastMuscleUpdate = p.millis();
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
        leadingAgent = getLeadingAgent();
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
            calculateFPS(p);
            let currentTime = p.millis();
            if (currentTime - lastUIUpdateTime > UIUpdateInterval) {
                // Update the FPS, Gen No, and Time Left values
                displayedTimeLeft = (simulationLength - tickCount) / (displayedFPS / simulationSpeed);

                // Reset the last update time
                lastUIUpdateTime = currentTime;
            }
            // Render the FPS, Gen No, and Time Left in every frame
            p.fill(255);  // White color for the text
            p.textSize(18);  // Font size
            p.text(`FPS: ${displayedFPS}`, 10, 20);
            p.text(`Generation: ${genCount}`, 10, 50);
            p.text(`Time Left: ${displayedTimeLeft.toFixed(0)} seconds`, 10, 80);
            p.text(`Top Score: ${topScoreEver}`, 10, 110);

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
    frameCountSinceLastFPS = 0;
    lastFPSCalculationTime = 0;
    tickCount = 0;

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

function calculateFPS(p) {
    frameCountSinceLastFPS++;
    let currentTime = p.millis();
    if (currentTime - lastFPSCalculationTime > UIUpdateInterval) {
        displayedFPS = frameCountSinceLastFPS / (UIUpdateInterval / 1000); // Convert to frames per second
        frameCountSinceLastFPS = 0;
        lastFPSCalculationTime = currentTime;
    }
}

//this agent will do for now, but I intend to replace with with a dynamic body plan that can 'evolve' over time.
//I think a JSON file defining a series of body and limb shapes, possibly with limbs connected to limbs etc
//Starting from a random config, this would not work, as there would be little chance of initial fitness, but starting from a simple body plan and exolving complexity based on randomness and fitness might work.
function Agent(numLimbs, existingBrain = null) {
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
    if (existingBrain) {
        this.brain = existingBrain;
    } else {
        this.brain = createNeuralNetwork(this.nnConfig);
    }

    this.getScore = function () {
        this.Score = Math.floor(this.centerBody.position.x / 10);
        if (this.Score > topScoreEver) {
            topScoreEver = this.Score;
        }
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
    genCount = 1;
    delay = delay || 50;
    for (let agent of agents) {
        World.remove(engine.world, [agent.centerBody, ...agent.limbs]);
        for (let muscle of agent.muscles) {
            World.remove(engine.world, muscle);
        }
        for (let joint of agent.joints) {
            World.remove(engine.world, joint);
        }
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

    // Remove only the agents' bodies and constraints from the world
    for (let agent of agents) {
        World.remove(engine.world, [agent.centerBody, ...agent.limbs]);
        for (let muscle of agent.muscles) {
            World.remove(engine.world, muscle);
        }
        for (let joint of agent.joints) {
            World.remove(engine.world, joint);
        }
    }

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
}

/*            Neural Network Functions                     */

function NeuralNetworkConfig(numLimbs) {
    this.inputNodes = numLimbs + 6; // Muscle lengths, agent x,y, agent velosity x,y, score, agent orientation
    this.hiddenLayers = [{ nodes: 10, activation: 'relu' }, { nodes: 5, activation: 'relu' }];
    this.outputNodes = numLimbs;
    this.mutationRate = Math.random();  // A random mutation rate between 0 and 1
}

function createNeuralNetwork(config) {
    const model = tf.sequential();

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

    let topPerformersCount = Math.round(topPerformerNo * popSize);
    topPerformersCount = Math.max(topPerformersCount, 2); // Ensure at least 2 top performers are selected

    // Create new agents for the top performers, but assign them the brains of the top performers
    for (let i = 0; i < topPerformersCount; i++) {
        let newAgent = new Agent(agents[i].numLimbs, agents[i].brain);
        newAgents.push(newAgent);
    }

    // Generate offspring
    while (newAgents.length < popSize) {
        let parent1 = selectAgent(agents);
        let parent2 = selectAgent(agents);
        let childBrain = await crossover(parent1, parent2);
        childBrain = mutate(childBrain, this.mutationRate);
        let childAgent = new Agent(limbsPerAgent);
        childAgent.brain.dispose();
        childAgent.brain = childBrain;
        newAgents.push(childAgent);
    }

    // Get a list of brains in the new generation
    let newBrains = newAgents.map(agent => agent.brain);

    // Dispose old agents and set the new ones
    agents.forEach(agent => {
        // Dispose the brain only if it's not being reused in the new generation
        if (!newBrains.includes(agent.brain) && agent.brain) {
            agent.brain.dispose();
        }
    });

    agents = newAgents;
    console.log('Restarting simulation with evolved agents!');
    console.log('Number of tensors after restart:', tf.memory().numTensors, 'Tensor Mem after restart', tf.memory().numBytes);
    // Reset simulation
    shouldUpdatePhysics = true;
    tickCount = 0;
    genCount++;
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
    // let childBrain = await cloneModel(agent1.brain, agent1.nnConfig);
    let childBrain = await createNeuralNetwork(agent1.nnConfig);
    let newWeights = tf.tidy(() => {
        let agent1Weights = agent1.brain.getWeights();
        let agent2Weights = agent2.brain.getWeights();
        let newWeightList = [];
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
            newWeightList.push(newWeight);
        }
        return newWeightList;
    });
    // let oldWeights = childBrain.getWeights();
    childBrain.setWeights(newWeights);
    // oldWeights.forEach(tensor => tensor.dispose());
    newWeights.forEach(weight => weight.dispose()); // Dispose of these tensors manually
    return childBrain;
}

function mutate(childBrain, mutationRate) {
    tf.tidy(() => {
        function mutateValues(values) {
            for (let i = 0; i < values.length; i++) {
                if (Math.random() < mutationRate) {
                    let adjustment = (Math.random() - 0.5) * 0.1;  // Adjust by max +/- 0.05
                    values[i] += adjustment;
                }
            }
        }
        let originalWeights = childBrain.getWeights();
        let mutatedWeights = originalWeights.map(w => {
            let values = w.arraySync();
            mutateValues(values);
            return tf.tensor(values);
        });

        childBrain.setWeights(mutatedWeights);
        // Just dispose of mutatedWeights since originalWeights tensors have not been cloned or changed
        mutatedWeights.forEach(w => w.dispose());
    });
    return childBrain; // Return the mutated childBrain
}


async function cloneModel(model, config) {
    // Create a new model with the same architecture
    const clonedModel = createNeuralNetwork(config);

    // Deep copy the weights of the original model to the cloned model
    const originalWeights = model.getWeights();
    const weightCopies = originalWeights.map(weight => weight.clone());

    const oldWeights = clonedModel.getWeights();

    // Set the cloned weights to the clonedModel
    clonedModel.setWeights(weightCopies);

    // Dispose of the cloned weights to free up memory
    oldWeights.forEach(tensor => tensor.dispose());
    weightCopies.forEach(weight => weight.dispose());

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
        "Orientation"
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
                        let muscleLength = agent.muscles[j].length.toFixed(2);
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
};

Agent.prototype.renderNN = function (p, offsetX, offsetY) {
    renderNeuralNetwork(p, this.nnConfig, this, offsetX, offsetY);
};

Agent.prototype.reset = function () {
    // Reset center body
    Body.setPosition(this.centerBody, { x: 100, y: 300 });
    Body.setVelocity(this.centerBody, { x: 0, y: 0 });
    Body.setAngularVelocity(this.centerBody, 0);
    this.Score = 0;

    // Reset limbs
    let angleIncrement = 2 * Math.PI / this.numLimbs;
    let limbWidth = 10;
    let bodyDiameter = this.centerBody.bounds.max.x - this.centerBody.bounds.min.x;
    let bodyRadius = bodyDiameter / 2;
    let distanceFromCenter = bodyRadius + 40 / 2; // 40 is the limb length

    for (let i = 0; i < this.numLimbs; i++) {
        let limbX = this.centerBody.position.x + distanceFromCenter * Math.cos(i * angleIncrement);
        let limbY = this.centerBody.position.y + distanceFromCenter * Math.sin(i * angleIncrement);

        Body.setPosition(this.limbs[i], { x: limbX, y: limbY });
        Body.setAngle(this.limbs[i], i * angleIncrement + Math.PI / 2);
        Body.setVelocity(this.limbs[i], { x: 0, y: 0 });
        Body.setAngularVelocity(this.limbs[i], 0);
    }

    // Reset muscles to original lengths
    for (let muscle of this.muscles) {
        muscle.length = muscle.originalLength;
    }
};
