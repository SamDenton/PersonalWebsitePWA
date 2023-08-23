let canvasWidth, canvasHeight, groundY, GravityStrength, FrictionStrength, renderedAgents, simulationSpeed, popSize, topPerformerNo;
let currentAgentIndex = 0;
let agents = [];
let offsetX = 0;
let p5Instance = null;
let delay;

let MAX_ADJUSTMENT = 10;

/* Planck vars */
let world;
const CATEGORY_GROUND = 0x0001;  // 0001 in binary
const CATEGORY_AGENT_BODY = 0x0002;  // 0010 in binary
const CATEGORY_AGENT_LIMB = 0x0004;  // 0100 in binary
let groundBody;

let shouldUpdatePhysics = true;
let genCount;
let displayedFPS = 0;
let displayedTimeLeft;
let frameCountSinceLastFPS;
let lastFPSCalculationTime;
let tickCount = 0;
let simulationLength;
let lastUIUpdateTime = 0;
let UIUpdateInterval = 500; 
let initializationStartTime;
let DELAY_DURATION = 0; // Delay starting physics to allow agents to spawn.  Disabled for now as it causes issues
let topScoreEver = 0;

let sketch = function (p) {
    let lastMuscleUpdate = 0;
    let muscleUpdateInterval = 1000; // Update every 100 ms
    initializationStartTime = 0;
    let fixedTimeStep = (1.0 / simulationSpeed) * 1000; // 'simulationSpeed' updates per second for physics
    let accumulator = 0;
    let lastTime = 0;
    let leadingAgent;

    p.setup = function () {
        p.frameRate(60);
        p.createCanvas(canvasWidth, canvasHeight);
        setupPlanckWorld();
        lastTime = p.millis();
    };

    p.draw = function () {
        if (!shouldUpdatePhysics) return;
        p.background(200);
        if (!(Date.now() - initializationStartTime < DELAY_DURATION)) {
            let currentTime = p.millis();
            let delta = currentTime - lastTime;
            lastTime = currentTime;

            accumulator += delta;

            while (accumulator >= fixedTimeStep) {
                updatePhysics();
                accumulator -= fixedTimeStep;
            }
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

            // Step the Planck world
            world.step(fixedTimeStep / 1000);

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

            offsetX = p.width / 4 - leadingAgent.position.x;  // Center the leading agent on the canvas

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

            // Ground
            let groundPosition = groundBody.getPosition();
            let groundStartX = groundPosition.x - offsetX;  // Adjust for camera offset
            let groundEndX = groundStartX + canvasWidth * 1000;  // Length of ground
            p.line(groundStartX, groundPosition.y - 10, groundEndX, groundPosition.y);

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
            leadingAgent.renderNN(p, canvasWidth - 400, (canvasHeight / 2) - 50);
        }
    };
};

function initializeSketchBox2D(width, height, groundYPosition, gravityStrength, frictionStrength, simLength, renderedAgentsNo, simSpeed, topPerformerNumber) {
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
    displayedTimeLeft = 0;

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
function Agent(numLimbs, agentNo, existingBrain = null) {
    this.numLimbs = numLimbs;
    let mainBodyRadius = 20;
    let startingX = 100;
    let startingY = 300;


    this.mainBody = createMainBody(world, startingX, startingY, mainBodyRadius, agentNo);
    this.position = this.mainBody.getPosition();

    this.limbs = [];
    this.muscles = [];
    this.joints = [];

    const limbWidth = 10; // Example limb width
    const limbLength = 40; // Example limb length
    let smallestAngle = -(Math.PI / 4);
    let largestAngle = Math.PI / 4;

    let nnConfig;

    for (let i = 0; i < numLimbs; i++) {
        let angle = (i * 2 * Math.PI) / numLimbs;
        let limbX = startingX + Math.cos(angle) * (mainBodyRadius + limbLength);
        let limbY = startingY + Math.sin(angle) * (mainBodyRadius + limbLength);

        let limb = createLimb(world, limbX, limbY, limbWidth, limbLength, angle - Math.PI / 2, agentNo, i);
        this.limbs.push(limb);

        // Calculate local anchor for bodyA (main body)
        let localAnchorA = planck.Vec2(
            mainBodyRadius * Math.cos(angle),
            mainBodyRadius * Math.sin(angle)
        );

        // Calculate local anchor for bodyB (limb) before rotation
        let x = 0;
        let y = -limbLength / 2; // Assuming the limb's anchor is at the top edge

        // Calculate the point after rotation
        let localAnchorB = planck.Vec2(0, -limbLength / 2);

        let joint = createRevoluteJoint(world, this.mainBody, limb, localAnchorA, localAnchorB, smallestAngle, largestAngle);
        this.joints.push(joint);
    }

    // Give the agent a brain!
    this.nnConfig = nnConfig || new NeuralNetworkConfig(numLimbs);
    if (existingBrain) {
        this.brain = existingBrain;
    } else {
        this.brain = createNeuralNetwork(this.nnConfig);
    }

    this.getScore = function () {
        this.Score = Math.floor(this.position.x / 10);
        if (this.Score > topScoreEver) {
            topScoreEver = this.Score;
        }
        return this.Score;  // 1 point for every 10px
    };

    this.render = function (p) {
        // Render the main body
        let mainPos = this.position;
        let mainAngle = this.mainBody.getAngle();
        p.push();
        p.translate(mainPos.x, mainPos.y);
        p.rotate(mainAngle);
        p.ellipse(0, 0, mainBodyRadius * 2, mainBodyRadius * 2);
        p.fill(0, 0, 0);
        p.pop();

        // Render the limbs
        for (let i = 0; i < numLimbs; i++) {
            let limb = this.limbs[i];
            let limbPos = limb.getPosition();
            let limbAngle = limb.getAngle();

            p.push();
            p.translate(limbPos.x, limbPos.y);
            p.rotate(limbAngle);
            p.rect(-limbWidth / 2, -limbLength / 2, limbWidth, limbLength);
            p.pop();
        }

        // Render the joints
        for (let i = 0; i < numLimbs; i++) {
            let jointPos = this.joints[i].getAnchorA();  // Assuming getAnchorA() gives the joint position attached to the main body
            p.fill(255, 0, 0);  // Fill with red color for visibility
            p.ellipse(jointPos.x, jointPos.y, 7, 7);  // Draw a small ellipse for each joint
        }
        for (let i = 0; i < numLimbs; i++) {
            let jointPos = this.joints[i].getAnchorB();  // Assuming getAnchorA() gives the joint position attached to the main body
            p.fill(0, 255, 0);  // Fill with red color for visibility
            p.ellipse(jointPos.x, jointPos.y, 3, 3);  // Draw a small ellipse for each joint
        }
    };
}

function createMainBody(world, x, y, radius, agentNo) {
    let bodyDef = {
        type: 'dynamic',
        position: planck.Vec2(x, y)
    };

    let body = world.createBody(bodyDef);
    let shape = planck.Circle(radius);
    let fixtureDef = {
        shape: shape,
        density: 0.1,
        filterCategoryBits: CATEGORY_AGENT_BODY,
        filterMaskBits: CATEGORY_GROUND  // Only allow collision with the ground
    };
    body.createFixture(fixtureDef);
    body.setUserData("Agent " + agentNo + " Main Body");
    return body;
}

function createLimb(world, x, y, width, height, angle, agentNo, limbNo) {
    let bodyDef = {
        type: 'dynamic',
        position: planck.Vec2(x, y),
        angle: angle
    };

    let body = world.createBody(bodyDef);
    let shape = planck.Box(width / 2, height / 2);
    let fixtureDef = {
        shape: shape,
        density: 0.1,
        filterCategoryBits: CATEGORY_AGENT_LIMB,
        filterMaskBits: CATEGORY_GROUND  // Only allow collision with the ground
    };
    body.createFixture(fixtureDef);
    body.setUserData("Agent " + agentNo + " Limb " + limbNo);

    return body;
}

function createRevoluteJoint(world, bodyA, bodyB, localAnchorA, localAnchorB, lowerAngle, upperAngle) {
    let jointDef = {
        bodyA: bodyA,
        bodyB: bodyB,
        localAnchorA: localAnchorA,
        localAnchorB: localAnchorB,
        lowerAngle: lowerAngle,
        upperAngle: upperAngle,
        enableLimit: true,
        motorSpeed: 0.0,
        maxMotorTorque: 100000.0,
        enableMotor: true
    };

    return world.createJoint(planck.RevoluteJoint(jointDef, bodyA, bodyB));
}

function initializeAgentsBox2D(agentProperties) {
    popSize = agentProperties.numAgents;
    limbsPerAgent = agentProperties.numLimbs;
    genCount = 1;
    delay = delay || 50;

    // If the world is already initialized, clean up the previous state
    if (world) {
        // Clear references to bodies and joints
        for (let agent of agents) {
            agent.joints = [];
            agent.limbs = [];
            agent.mainBody = null;
        }
    }

    initializationStartTime = Date.now();

    // Initialize the world with gravity
    // world = planck.World(planck.Vec2(0, -10));  // Adjust gravity as needed

    agents = [];  // Reset the agents array

    // Create and add new agents to the Planck world
    for (let i = 0; i < popSize; i++) {
        setTimeout(() => {
            agents.push(new Agent(limbsPerAgent, i));
        }, i * delay);
    }

    offsetX = 0;
}

function getLeadingAgent() {
    if (agents.length === 0) return null;

    return agents.reduce((leading, agent) =>
        (agent.position.x > leading.position.x ? agent : leading),
        agents[0]
    );
}

function endSimulation(p) {
    shouldUpdatePhysics = false;
    p.noLoop();

    // Destroy bodies and joints
    for (let agent of agents) {
        // Destroy the joints first
        for (let joint of agent.joints) {
            world.destroyJoint(joint);
        }

        // Destroy the limbs
        for (let limb of agent.limbs) {
            world.destroyBody(limb);
        }

        // Destroy the main body
        world.destroyBody(agent.mainBody);

        agent.joints = [];
        agent.limbs = [];
        agent.mainBody = null;
    }

    // Continue to the next generation
    nextGeneration(p);
}

function setupPlanckWorld() {
    // Create the Planck.js world
    const gravity = planck.Vec2(0.0, GravityStrength * 9.8);
    world = planck.World(gravity);

    world.on('begin-contact', function (contact) {
        let fixtureA = contact.getFixtureA();
        let fixtureB = contact.getFixtureB();
        let bodyA = fixtureA.getBody();
        let bodyB = fixtureB.getBody();

        //console.log("Collision between:", bodyA.getUserData(), "and", bodyB.getUserData());
    });

    // Create the ground body
    const groundBodyDef = {
        type: 'static',
        position: planck.Vec2(0, groundY + 10)
    };
    groundBody = world.createBody(groundBodyDef);
    groundBody.setUserData("Ground");
    // Define the ground shape and add it as a fixture to the ground body
    const groundShape = planck.Box(canvasWidth * 1000, 10); // half width, half height
    let fixtureDef = {
        shape: groundShape,
        filterCategoryBits: CATEGORY_GROUND,
        filterMaskBits: CATEGORY_AGENT_BODY | CATEGORY_AGENT_LIMB 
    }
    groundBody.createFixture(fixtureDef); // Static bodies like the ground don't need a density, it's ignored
}

/*            Neural Network Functions                     */

function NeuralNetworkConfig(numLimbs) {
    this.inputNodes = (numLimbs * 2) + 6; // Muscle angles, speeds, agent x,y, agent velosity x,y, score, agent orientation
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
    console.log("Number of bodies:", world.getBodyCount());
    console.log("Number of joints:", world.getJointCount());
    // Reset simulation
    initializationStartTime = Date.now();
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
        ...Array(agent.numLimbs).fill(null).map((_, idx) => `Joint Angle ${idx + 1}`),
        ...Array(agent.numLimbs).fill(null).map((_, idx) => `Joint Speed ${idx + 1}`),
        "Agent's X",
        "Agent's Y",
        "Velocity X",
        "Velocity Y",
        "Score",
        "Orientation"
    ];

    let outputLabels = Array(nnConfig.outputNodes).fill(null).map((_, idx) => `Joint ${idx + 1}`);

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
                    p.text(labels[j], x - 80, y + 4);
                } else if (i === nnConfig.hiddenLayers.length + 1) {
                    p.text(labels[j], x + 15, y + 4);

                    // Display the current muscle length as an indication
                    if (agent) {
                        let currentSpeed = agent.joints[j].getMotorSpeed();
                        p.text(`Speed: ${currentSpeed.toFixed(4)}`, x + 60, y + 4);
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
        for (let i = 0; i < this.joints.length; i++) {
            let adjustment = output[i] * MAX_ADJUSTMENT;  // Scales the adjustment based on the output
            let currentSpeed = this.joints[i].getMotorSpeed();
            this.joints[i].setMotorSpeed(adjustment);
        }
    });
};


Agent.prototype.collectInputs = function () {
    let inputs = [];

    // 1. Joint angles
    for (let joint of this.joints) {
        let jointAngle = joint.getJointAngle();

        // Error alert
        if (isNaN(jointAngle)) {
            alert("Joint angle is NaN!");
        }

        inputs.push(jointAngle);
    }

    // 2. Joint speeds
    for (let joint of this.joints) {
        let jointSpeed = joint.getJointSpeed();

        // Error alert
        if (isNaN(jointSpeed)) {
            alert("Joint speed is NaN!");
        }

        inputs.push(jointSpeed);
    }

    // 3. Agent's position (x,y)
    let position = this.mainBody.getPosition();
    inputs.push(position.x);
    inputs.push(position.y);

    // 4. Agent's velocity (x,y)
    let velocity = this.mainBody.getLinearVelocity();
    inputs.push(velocity.x);
    inputs.push(velocity.y);

    // 5. Score
    inputs.push(this.getScore());

    // 6. Agent's orientation
    inputs.push(this.mainBody.getAngle());

    return inputs;
};



Agent.prototype.updateMuscles = function () {
    let inputs = this.collectInputs();
    this.makeDecision(inputs);
};

Agent.prototype.renderNN = function (p, offsetX, offsetY) {
    renderNeuralNetwork(p, this.nnConfig, this, offsetX, offsetY);
};