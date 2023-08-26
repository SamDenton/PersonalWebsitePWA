let canvasWidth, canvasHeight, groundY, GravityStrength, FrictionStrength, renderedAgents, simulationSpeed, popSize, topPerformerNo;
let currentAgentIndex = 0;
let agents = [];
let isInitializationComplete;
let offsetX = 0;
let p5Instance = null;
let delay;
let numGroups;
const GROUP_COLORS = [
    '#FF5733', '#33FF57', '#3357FF', '#FF33F4', '#FFFC33', '#F05703', '#376D57', '#3328CF', '#FF33FF', '#F4FC33'
];

let MAX_ADJUSTMENT = 10;

/* Planck vars */
let world;
const CATEGORY_GROUND = 0x0001;  // 0001 in binary
const CATEGORY_AGENT_BODY = 0x0002;  // 0010 in binary
const CATEGORY_AGENT_LIMB = 0x0004;  // 0100 in binary
let groundBody;

/* TensorFlow vars */
const TOURNAMENT_SIZE = 5; // Pick x number of agents from each group to compete to be parent during crossover
const CROSS_GROUP_PROBABILITY = 0.05; // 5% chance to select from the entire population instead of within the same group

let genCount;
let displayedFPS = 0;
let displayedTimeLeft;
let frameCountSinceLastFPS;
let lastFPSCalculationTime;
let tickCount = 0;
let simulationLength;
let lastUIUpdateTime = 0;
let UIUpdateInterval = 500; 
let topScoreEver = 0;
let randomlySelectedAgents = [];


/*              I should Turn most of my global vars into an object, or multiple, and pass that between the functions that require it             */

let sketch = function (p) {
    let lastMuscleUpdate = 0;
    let muscleUpdateInterval = 1000; // Update every 100 ms
    let fixedTimeStep = (1.0 / simulationSpeed) * 1000; // 'simulationSpeed' updates per second for physics
    let accumulator = 0;
    let lastTime = 0;
    let leadingAgent;
    let currentPhysicsBatch = 0;
    const BATCH_SIZE = 10;  // Number of agents per batch
    let SOME_DELAY_FRAME_COUNT = 5;

    p.setup = function () {
        p.frameRate(60);
        p.createCanvas(canvasWidth, canvasHeight);
        setupPlanckWorld();
        lastTime = p.millis();
    };

    p.draw = function () {
        p.background(200);

        let currentTime = p.millis();
        let delta = currentTime - lastTime;
        lastTime = currentTime;

        accumulator += delta;

        while (accumulator >= fixedTimeStep) {
            updatePhysics();
            accumulator -= fixedTimeStep;
        }

        // If enough time has passed, move to the next batch
        if (p.frameCount % SOME_DELAY_FRAME_COUNT == 0) {
            if (currentPhysicsBatch * BATCH_SIZE >= agents.length) {
                currentPhysicsBatch = 0;  // Reset to the start
            } else {
                currentPhysicsBatch++;
            }
        }

        renderScene(p);
    };

    function updatePhysics() {
        leadingAgent = getLeadingAgent();
        if (leadingAgent) {
            // If initialization is complete, then update muscles
            if (isInitializationComplete && areAllAgentsStable() && p.millis() - lastMuscleUpdate > muscleUpdateInterval) {
                // Update muscles only for the current batch of agents
                for (let i = currentPhysicsBatch * BATCH_SIZE; i < Math.min((currentPhysicsBatch + 1) * BATCH_SIZE, agents.length); i++) {
                    agents[i].updateMuscles();
                }
                //for (let agent of agents) {
                //    agent.updateMuscles();
                //}
                lastMuscleUpdate = p.millis();
            }

            // Step the Planck world
            world.step(fixedTimeStep / 1000);

            // If initialization is complete, increment the tick count
            if (isInitializationComplete && areAllAgentsStable()) {
                tickCount++;
                if (tickCount >= simulationLength) {
                    endSimulation(p);
                }
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
            let leadingAgentScores = leadingAgent.getScore();
            let leadingAgentScore = leadingAgentScores[0];
            let leadingAgentXScore = leadingAgentScores[1];
            let leadingAgentYScore = leadingAgentScores[2];
            let leadingAgentMovementScore = leadingAgentScores[3];
            p.fill(0);  // Black text
            p.textSize(16);  // Font size
            p.text(`Leading Agent Score: ${leadingAgentScore} (X Score: ${leadingAgentXScore} + Y Score: ${leadingAgentYScore} + Joint Movement Score: ${leadingAgentMovementScore})`, 10, groundY + 30);  // Displaying the score just below the ground

            let agentsToRender = new Set(randomlySelectedAgents);  // Use a Set to ensure uniqueness
            agentsToRender.add(leadingAgent);  // Always add the leading agent

            for (let agent of agents) {
                if (agentsToRender.has(agent)) {
                    agent.render(p, offsetX);
                }
            }

            //let agentsToRender = randomlySelectedAgents;  // Use a Set to ensure uniqueness
            //agentsToRender.push(leadingAgent);  // Always add the leading agent
            //agentsToRender.sort((a, b) => a.leadingAgentScore - b.leadingAgentScore);
            //for (let agent of agentsToRender) {
            //    agent.render(p, offsetX);
            //}

            calculateFPS(p);

            let currentTime = p.millis();
            if (currentTime - lastUIUpdateTime > UIUpdateInterval) {
                // Update the FPS, Gen No, and Time Left values
                //let TimeLeft = (simulationLength - tickCount) * (1 / simulationSpeed);
                //if (TimeLeft < displayedTimeLeft) {
                //    displayedTimeLeft = TimeLeft;
                //}
                displayedTimeLeft = (simulationLength - tickCount) * (1 / simulationSpeed);

                // Reset the last update time
                lastUIUpdateTime = currentTime;
            }
            // Render the FPS, Gen No, and Time Left in every frame
            p.fill(0);  // White color for the text
            p.textSize(18);  // Font size
            p.text(`FPS: ${displayedFPS}`, 10, 20);
            p.text(`Generation: ${genCount}`, 10, 50);
            p.text(`Time Left: ${displayedTimeLeft.toFixed(0)} seconds`, 10, 80);
            p.text(`Top Score: ${topScoreEver.toFixed(2)}`, 10, 110);
            p.text(`Distinct Population groups: ${numGroups}`, 10, 140);

            if (!isInitializationComplete && areAllAgentsStable()) {
                p.text(`Loading in agents!`, 10, 170);
            }
            else {
                p.text(`Agents can go!`, 10, 170);
            }

            // Render NN for leading agent
            p.fill(GROUP_COLORS[leadingAgent.group]);
            leadingAgent.renderNN(p, canvasWidth - 400, (canvasHeight / 2) - 50);
        }
    };
};

function areAllAgentsStable() {
    const stabilityThreshold = 0.001;  // Define a small threshold value for stability
    for (let agent of agents) {
        if (agent.mainBody) {
            if (Math.abs(agent.mainBody.getLinearVelocity()) > stabilityThreshold) {
                return false;
            }
        }
    }
    return true;
}

function initializeSketchBox2D(stageProperties) {
    canvasWidth = stageProperties.width;
    canvasHeight = stageProperties.height;
    groundY = stageProperties.groundY;
    GravityStrength = stageProperties.gravity;
    FrictionStrength = stageProperties.fiction;
    simulationLength = stageProperties.simulationLength;
    renderedAgents = stageProperties.renderedAgents;
    simulationSpeed = stageProperties.simSpeed;
    topPerformerNo = stageProperties.topPerformerNo;
    spawnDelay = stageProperties.delay;
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
    this.group = null;
    console.log("a new agent");
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

    this.previousJointAngles = this.joints.map(joint => joint.getJointAngle());

    this.getJointMovementReward = function () {
        let totalChange = 0;
        for (let i = 0; i < this.joints.length; i++) {
            let currentAngle = this.joints[i].getJointAngle();
            let change = Math.abs(currentAngle - this.previousJointAngles[i]);
            totalChange += change;

            // Update the previous angle for next time
            this.previousJointAngles[i] = currentAngle;
        }

        // Decay factor (for example 0.8) will reduce reward for same joint movements
        let reward = totalChange * 0.8;

        return reward;
    };

    this.getScore = function () {
        // Score function.  One of the most important to get right to give the agents a fitness score
        let XPosScore = (Math.floor(this.position.x) * 1); // Main score multiplier, 1 point per px moved right
        let YPosScore = (Math.floor(this.position.y) * 0.3); // 0.3 points per px moved upwards, to encourage standing / walking
        let jointMovementReward = (this.getJointMovementReward() * 1); // Small score bonus more increased joint movement.
        this.Score = XPosScore + YPosScore + jointMovementReward;
        if (this.Score > topScoreEver) {
            topScoreEver = this.Score;
        }
        return [
            this.Score.toFixed(2),
            XPosScore.toFixed(2),
            YPosScore.toFixed(2),
            jointMovementReward.toFixed(2)
        ];
    };

    this.render = function (p) {
        // Set the fill color based on group
        p.fill(GROUP_COLORS[this.group]);

        // Render the main body
        if (this.mainBody) {
            let mainPos = this.position;
            let mainAngle = this.mainBody.getAngle();
            p.push();
            p.translate(mainPos.x, mainPos.y);
            p.rotate(mainAngle);
            p.ellipse(0, 0, mainBodyRadius * 2, mainBodyRadius * 2);
            p.pop();
        }

        // Render the limbs
        for (let i = 0; i < numLimbs; i++) {
            let limb = this.limbs[i];
            if (limb) {
                let limbPos = limb.getPosition();
                let limbAngle = limb.getAngle();
                p.push();
                p.translate(limbPos.x, limbPos.y);
                p.rotate(limbAngle);
                p.rect(-limbWidth / 2, -limbLength / 2, limbWidth, limbLength);
                p.pop();
            }
        }

        // Render the joints
        for (let i = 0; i < numLimbs; i++) {
            if (this.joints[i]) {
                let jointPos = this.joints[i].getAnchorA();  // Assuming getAnchorA() gives the joint position attached to the main body
                p.fill(255, 0, 0);  // Fill with red color for visibility
                p.ellipse(jointPos.x, jointPos.y, 7, 7);  // Draw a small ellipse for each joint
            }
        }
        for (let i = 0; i < numLimbs; i++) {
            if (this.joints[i]) {
                let jointPos = this.joints[i].getAnchorB();  // Assuming getAnchorA() gives the joint position attached to the main body
                p.fill(0, 255, 0);  // Fill with green color for visibility
                p.ellipse(jointPos.x, jointPos.y, 3, 3);  // Draw a small ellipse for each joint
            }
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
    let BATCH_SIZE = 20;
    popSize = agentProperties.numAgents;
    limbsPerAgent = agentProperties.numLimbs;
    genCount = 1;
    isInitializationComplete = false;

    // If the world is already initialized, clean up the previous state
    if (world) {
        // Clear references to bodies and joints
        for (let agent of agents) {
            // Destroy the joints first
            for (let joint of agent.joints) {
                if (joint) { // Check if joint exists and is in the world
                    world.destroyJoint(joint);
                }
            }

            // Destroy the limbs
            for (let limb of agent.limbs) {
                if (limb) { // Check if body exists and is in the world
                    world.destroyBody(limb);
                }
            }

            // Destroy the main body
            if (agent.mainBody) {
                world.destroyBody(agent.mainBody);
            }

            agent.joints = [];
            agent.limbs = [];
            agent.mainBody = null;
        }
    }

    const MIN_GROUP_SIZE = 20;  // Minimum number of agents per pop group
    const MAX_GROUP_SIZE = 50;  // this is an upper limit, can adjust based on tests

    // Calculate the number of groups
    numGroups = Math.max(1, Math.ceil(popSize / MAX_GROUP_SIZE));
    let agentsPerGroup = Math.ceil(popSize / numGroups);

    // Adjust if the population is too small
    if (popSize <= MIN_GROUP_SIZE) {
        numGroups = 1;
        agentsPerGroup = popSize;
    }

    agents = [];  // Reset the agents array

    // Initialize agents in batches
    for (let i = 0; i < popSize; i += BATCH_SIZE) {
        initializeAgentBatch(i, Math.min(i + BATCH_SIZE, popSize), agentsPerGroup);
    }

    waitForFirstInitializationCompletion();

    displayedTimeLeft = (simulationLength - tickCount) * (1 / simulationSpeed);
    offsetX = 0;
}

// Function to initialize a batch of agents
function initializeAgentBatch(startIndex, endIndex, agentsPerGroup) {
    for (let i = startIndex; i < endIndex; i++) {
        initializeAgent(i, agentsPerGroup);
    }
}

// Function to initialize a single agent
function initializeAgent(i, agentsPerGroup) {
    setTimeout(() => {
        let agent = new Agent(limbsPerAgent, i);
        agent.group = Math.floor(i / agentsPerGroup);  // Assign group
        agents.push(agent);

        // If this is the last agent, mark initialization as complete
        if (agents.length >= popSize - 1) {
            isInitializationComplete = true;
        }
    }, i * delay);
}

function waitForFirstInitializationCompletion() {
    // Check if agents initialised
    if (isInitializationComplete) {
        // Randomly select agents to render for each group
        randomlySelectedAgents = [];
        for (let groupId = 0; groupId < numGroups; groupId++) {
            let groupAgents = agents.filter(agent => agent.group === groupId);

            // Select leading agent
            let leadingAgent = groupAgents.sort((a, b) => b.getScore() - a.getScore())[0];
            randomlySelectedAgents.push(leadingAgent);

            // Select few random agents
            for (let i = 0; i < renderedAgents; i++) {
                let randomIndex = Math.floor(Math.random() * groupAgents.length);
                randomlySelectedAgents.push(groupAgents[randomIndex]);
            }
        }
    } else {
        // If the agents not initialised, wait for some time and check again
        setTimeout(waitForFirstInitializationCompletion, 100); // Checking every 100ms
    }
}

function getLeadingAgent() {
    if (agents.length === 0) return null;

    return agents.reduce((leading, agent) =>
        (agent.position.x > leading.position.x ? agent : leading),
        agents[0]
    );
}

function endSimulation(p) {
    p.noLoop();
    isInitializationComplete = false;
    console.log("round over");
    for (let agent of agents) {
        // Destroy the joints first
        for (let joint of agent.joints) {
            if (joint) { // Check if joint exists and is in the world
                world.destroyJoint(joint);
            }
        }

        // Destroy the limbs
        for (let limb of agent.limbs) {
            if (limb) { // Check if body exists and is in the world
                world.destroyBody(limb);
            }
        }

        // Destroy the main body
        if (agent.mainBody) {
            world.destroyBody(agent.mainBody);
        }

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

    // Adds event listener for collisions, console logged.
    //world.on('begin-contact', function (contact) {
    //    let fixtureA = contact.getFixtureA();
    //    let fixtureB = contact.getFixtureB();
    //    let bodyA = fixtureA.getBody();
    //    let bodyB = fixtureB.getBody();

    //    console.log("Collision between:", bodyA.getUserData(), "and", bodyB.getUserData());
    //});

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
    this.inputNodes = (numLimbs * 2) + 7; // Muscle angles, speeds, agent x,y, agent velosity x,y, score, agent orientation
    this.hiddenLayers = [{ nodes: 10, activation: 'relu' }, { nodes: 5, activation: 'relu' }];
    this.outputNodes = numLimbs;
    this.mutationRate = 0.05;
    //this.mutationRate = Math.random();  // A random mutation rate between 0 and 1
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

function nextGeneration(p) {
    let newAgents = [];
    let groupAgents;
    let topPerformersCount;
    agents.sort((a, b) => b.getScore() - a.getScore()); // Sort in descending order of score

    for (let groupId = 0; groupId < numGroups; groupId++) {

        groupAgents = agents.filter(agent => agent.group === groupId); // Filter agents of this group

        topPerformersCount = Math.round(topPerformerNo * groupAgents.length);

        topPerformersCount = Math.max(topPerformersCount, 2); // Ensure at least 2 top performers are selected

        // Create new agents, but assign them the brains of previous top performers from the group
        createTopPerformers(groupAgents, topPerformersCount, groupId, newAgents);

        // Generate offspring within the group
        generateOffspring(groupAgents, newAgents, groupId);
    }

    waitForInitializationCompletion(newAgents);

    console.log('Restarting simulation with evolved agents!');

    // Reset simulation
    // await new Promise(resolve => setTimeout(resolve, 1000));
    displayedTimeLeft = (simulationLength - tickCount) * (1 / simulationSpeed);
    p.loop();
    currentPhysicsBatch = 0;
    tickCount = 0;
    genCount++;
}

// Function to create top performers for the next generation
function createTopPerformers(groupAgents, topPerformersCount, groupId, newAgents) {
    for (let i = 0; i < topPerformersCount; i++) {
        setTimeout(() => {
            let newAgent = new Agent(groupAgents[i].numLimbs, groupAgents[i].brain);
            newAgent.group = groupId; // Assign group
            newAgents.push(newAgent);
        }, i * delay);
        console.log("creating agents from top performers" + i);
    }
}

// Function to generate offspring for the next generation
function generateOffspring(groupAgents, newAgents, groupId) {
    function createChildAgent() {
        if (newAgents.filter(agent => agent.group === groupId).length >= groupAgents.length) {
            // All agents for this group have been created
            return;
        }
        let parent1 = selectAgent(groupAgents, agents);
        let parent2 = selectAgent(groupAgents, agents, parent1);

        let childBrain = crossover(parent1, parent2);
        childBrain = mutate(childBrain, this.mutationRate);

        let childAgent = new Agent(limbsPerAgent);
        childAgent.brain.dispose();
        childAgent.brain = childBrain;
        childAgent.group = groupId; // Assign group
        newAgents.push(childAgent);
        // console.log("generating agent: " + newAgents.length + "total for this group: " + groupAgents.length + "in group: " + groupId);
        setTimeout(createChildAgent, delay);
    }

    createChildAgent();
}

function selectAgent(agents, allAgents, excludedAgent = null) {
    // Occasionally pick from the entire population
    if (Math.random() < CROSS_GROUP_PROBABILITY) {
        agents = allAgents;
    }

    // Tournament Selection
    let tournamentContestants = [];

    for (let i = 0; i < TOURNAMENT_SIZE; i++) {
        let randomAgent;
        do {
            randomAgent = agents[Math.floor(Math.random() * agents.length)];
        } while (tournamentContestants.includes(randomAgent) || randomAgent === excludedAgent);
        tournamentContestants.push(randomAgent);
    }

    // Return the agent with the highest score from the tournament contestants
    return tournamentContestants.sort((a, b) => b.getScore() - a.getScore())[0];
}

function crossover(agent1, agent2) {
    let childBrain = createNeuralNetwork(agent1.nnConfig);
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

    childBrain.setWeights(newWeights);
    // oldWeights.forEach(tensor => tensor.dispose());
    newWeights.forEach(weight => weight.dispose()); // Dispose of these tensors manually.  Might not need as well as tf.tidy
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

// Recursive function checking if agents have finished loading into world
function waitForInitializationCompletion(newAgents) {
    // Check if the condition is met
    if (newAgents.length >= popSize) {

        // Get a list of brains in the new generation
        let newBrains = newAgents.map(agent => agent.brain);

        isInitializationComplete = true;
        // Dispose old agents
        agents.forEach(agent => {
            // Dispose the brain only if it's not being reused in the new generation
            if (!newBrains.includes(agent.brain) && agent.brain) {
                agent.brain.dispose();
            }
        });

        agents = newAgents;

        // Randomly select agents to render for each group
        randomlySelectedAgents = [];
        for (let groupId = 0; groupId < numGroups; groupId++) {

            // Re-filter by group
            groupAgents = agents.filter(agent => agent.group === groupId);

            // Select leading agent
            let leadingAgent = groupAgents.sort((a, b) => b.getScore() - a.getScore())[0];
            randomlySelectedAgents.push(leadingAgent);

            // Select few random agents
            for (let i = 0; i < renderedAgents; i++) {
                let randomIndex = Math.floor(Math.random() * groupAgents.length);
                randomlySelectedAgents.push(groupAgents[randomIndex]);
            }
        }

        console.log('Number of tensors after restart:', tf.memory().numTensors, 'Tensor Mem after restart', tf.memory().numBytes);
        console.log("Number of bodies:", world.getBodyCount());
        console.log("Number of joints:", world.getJointCount());

    } else {
        // If the condition is not met, wait for some time and check again
        setTimeout(() => waitForInitializationCompletion(newAgents), 100); // Checking every 100ms for example
    }
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
        "Orientation",
        "Time Left"
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

                    // Display the current joint speed as an indication
                    let joint = agent.joints[j];
                    if (joint) {
                        let currentSpeed = joint.getMotorSpeed();
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
            let adjustment = output[i];  // ( * MAX_ADJUSTMENT) Scales the adjustment based on the output
            let currentSpeed = this.joints[i].getMotorSpeed();
            if (adjustment != currentSpeed) {
                this.joints[i].setMotorSpeed(adjustment);
            }
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

    // 7 Time remaining
    inputs.push(displayedTimeLeft);

    // Want to add to this; sensors for distance to ground?
    return inputs;
};

Agent.prototype.updateMuscles = function () {
    let inputs = this.collectInputs();
    this.makeDecision(inputs);
};

Agent.prototype.renderNN = function (p, offsetX, offsetY) {
    renderNeuralNetwork(p, this.nnConfig, this, offsetX, offsetY);
};