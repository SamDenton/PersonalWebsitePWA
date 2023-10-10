/* Initialization vars taken from C# */
let canvasWidth, canvasHeight, groundY, GravityStrength, FrictionStrength, simulationSpeed, showNeuralNetwork, delay, UIUpdateInterval, simulationLength, torque, maxJointMovement, jointMaxMove;
let renderedAgents, popSize, topPerformerNo, agentToFix, BATCH_SIZE, MAX_ADJUSTMENT, CROSS_GROUP_PROBABILITY, MIN_GROUP_SIZE, MAX_GROUP_SIZE, TOURNAMENT_SIZE, MUSCLE_BATCH_SIZE, SOME_DELAY_FRAME_COUNT, muscleUpdateFrames, brainDecay;
let velocityIterations, positionIterations, physicsGranularityMultiplier;
let inputsJointAngle, inputsJointSpeed, inputsGroundSensors, inputsAgentPos, inputsAgentV, inputsScore, inputsOrientation, inputsTimeRemaining;



/* Index's, flags */
let currentAgentIndex = 0;
let offsetX = 0;
let displayedFPS = 0;
let tickCount = 0;
let lastUIUpdateTime = 0;
let topScoreEver = 0;
let stabilityCounter = 0;
let selectedColor = null;
let isInitializationComplete, lastFPSCalculationTime, genCount, displayedTimeLeft, frameCountSinceLastFPS, simulationStarted, nextBatchFrame, usedIndice, averageScore, currentProcess;

/* P5 vars */
let p5Instance = null;

/* Grouping arrays */
let agents = [];
let leadingAgents = [];
let randomlySelectedAgents = [];

/* Agent and joint colours */
const GROUP_COLORS = [
    '#A03472', '#35682D', '#ED760E', '#E4A010', '#6C6960', '#E55137', '#6C6874', '#CDA434', '#9C9C9C', '#6D3F5B',
    '#354D73', '#008F39', '#E6D690', '#316650', '#FAD201', '#1D334A', '#5D9B9B', '#6C7156', '#F80000', '#3F888F',
    '#FF5733', '#33FF57', '#25221B', '#874B4E', '#424632', '#4A192C', '#3357FF', '#FF33F4', '#FFFC33', '#F00003',
    '#376D57', '#3328CF', '#FF33FF', '#F4FC33', '#8A6642', '#B5B8B1', '#781F19', '#8A9597', '#F5D033', '#633A34'
];

const JOINT_COLORS = [
    '#376D57', '#3328CF', '#FF33FF', '#F4FC33', '#8A6642', '#B5B8B1', '#781F19', '#8A9597', '#F5D033', '#633A34',
    '#FF5733', '#33FF57', '#25221B', '#474B4E', '#424632', '#4A192C', '#3357FF', '#FF33F4', '#FFFC33', '#F05703'
];

/* Planck vars */
let world, groundBody;
const CATEGORY_GROUND = 0x0001;
const CATEGORY_AGENT_BODY = 0x0002; 
const CATEGORY_AGENT_LIMB = 0x0004; 

/* TensorFlow vars */
let numGroups;

/* 
Further Optomisations:
            -Currently using both frame counts and ms counts for batch processing
            -Optomize how often I call getScore() as its very taxing now
            -Can spread out agent spawning further
            -Can speard out agent muscle descisions further (seems less impactful)
            -Can set physics updates lower while agents are spawning
            -Can set collision logic lower while spawning, could hold agents in position so thay cant fall through ground and have collisions turned off while spawning, then slowly turn it back on before round starts
            -I should Turn most of my global vars into an object, or multiple, and pass that between the functions that require it
            -I should experament with how often I actually need physics collisions to run, they only interact with the ground, and dont move very fast.  I could also make the ground thicker
            -These are the functions causing the biggest frame drops and delays:
                41485 ms  Scripting
                55 ms  Rendering
                1002 ms  Painting
                1971 ms  System
                663 ms  Idle
                45177 ms  Total

                t.createContact
                e.solveVelocityConstraints
                e._solvePositionConstraint
                e.initVelocityConstraints
                renderNeuralNetwork
                t.tidy > t.dataSync > n.getValuesFromTexture > ... > readPixels > Optimize Code
                getLeadingAgent

                updatePhysics > t.step > t.query > release > set length

                ???
                updatePhysics > t.step > t.query > Event Timing > Event Timing > Event Timing > Event Timing > Event Timing > Event Timing > e.solveWorldTOI > t.recycle > Event Timing > Event Timing > Event Timing > Event Timing > Event Timing > Event Timing > Event Timing > t.step > World.ts:784:3 > t.query > DynamicTree.ts:736:3 >  e.solveWorld > Solver.ts:168:3 > e.solveIsland > e.solveVelocityConstraints > RevoluteJoint.ts:558:3 > t.solve33 > Mat33.ts:84:3 > t.addCombine > Vec2.ts:246:3 > t.crossNumVec2 > Vec3 > Minor GC


                -issue might be bodies on top of each other.  can we spread them in the world, but render them on top of each other?


 */

/* 
Ideas:      
            -I want to evolve agent body plan over time, use a json for construction.  Agents should start simple and get more complex over time so they dont have to leavn to control a complex body right away.  I think thats the best way.  Wings????
            -I want to have the enviromet both configurable on startup, and for it to get more challenging over generations
            -I want to save agents, either individuals or populations, to re-use later.  Would be good to have a property tracking agent history, its own top score, what the parameters where when it got that score, etc.
            -I want to evolve the inputs and outputs of the network, from a selection of available
            -I want to evolve the topology of the networks themselevs using NEAT so they can decide how complex they need to be
            -As part of NEAT, look at different limb types (wheels, single limb, jointed/double limb, wing(?), balance)

            -Could look into ideas like regularization and pruning.  Think about reducing agents brain weights over time selectively?
*/

let sketch = function (p) {
    nextBatchFrame = 0;
    let fixedTimeStep = (1.0 / simulationSpeed) * 1000; // 'simulationSpeed' updates per second for physics
    let accumulator = 0;
    let lastTime = 0;
    let leadingAgent;
    let currentPhysicsBatch = 0;
    let leadingAgentScores;
    let leadingAgentScore;
    let leadingAgentXScore;
    let leadingAgentYScore;
    let leadingAgentMovementScore;
    let trailingAgent = agents[agents.length - 1];
    let trailingAgentScores;
    let trailingAgentScore;
    let trailingAgentXScore;
    let trailingAgentYScore;
    let trailingAgentMovementScore;
    let topScoreAgent = agents[0];
    let topScoreAgentScores;
    let topScoreAgentScore;
    let topScoreAgentXScore;
    let topScoreAgentYScore;
    let topScoreAgentMovementScore;

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
        leadingAgent = getLeadingAgent(p.frameCount);
        trailingAgent = getLastAgent();
        accumulator += delta;

        while (accumulator >= fixedTimeStep) {
            updatePhysics();
            accumulator -= fixedTimeStep;
        }

        renderScene(p);
    };

    function updatePhysics() {
        if (leadingAgent) {
            // If initialization is complete, then update muscles
            if (isInitializationComplete && !simulationStarted) {
                if (areAllAgentsStable()) {
                    console.log("starting round"); 
                    simulationStarted = true;
                }

            }

            if (simulationStarted) {
                // Check if it's time to update the next batch
                if (tickCount >= nextBatchFrame) {
                    // Update muscles only for the current batch of agents
                    for (let i = currentPhysicsBatch * MUSCLE_BATCH_SIZE; i < Math.min((currentPhysicsBatch + 1) * MUSCLE_BATCH_SIZE, agents.length); i++) {
                        agents[i].updateMuscles();

                        if (i == 1) {
                            console.log("updating agent 1's muscles");
                        }
                    }

                    // Move to the next batch
                    currentPhysicsBatch++;

                    // Reset to the start if all batches are processed
                    if (currentPhysicsBatch * MUSCLE_BATCH_SIZE >= agents.length) {
                        currentPhysicsBatch = 0;

                        // Wait for muscleUpdateFrames before updating muscles again
                        nextBatchFrame = tickCount + muscleUpdateFrames;
                    } else {
                        // Wait for batchDelay frames before moving to the next batch
                        nextBatchFrame = tickCount + SOME_DELAY_FRAME_COUNT;
                    }
                }
            }

            // Step the Planck world
            try {
                world.step(fixedTimeStep / 1000 * physicsGranularityMultiplier, velocityIterations, positionIterations);
            } catch (error) {
                console.error("An error occurred stepping physics simulation: ", error);
            }
            // If initialization is complete, increment the tick count
            if (simulationStarted) {
                tickCount++;
                if (tickCount >= simulationLength) {
                    endSimulation(p);
                }
            }
        }
    }

    function renderScene(p) {
        if (leadingAgent) {

            if (agentToFix == "leader") {
                offsetX = p.width / 6 - leadingAgent.position.x + leadingAgent.startingX;  // Center the leading agent on the canvas, just to the left
            } else if (agentToFix == "trailer") {
                offsetX = p.width / 6 - trailingAgent.position.x + trailingAgent.startingX;
            } else if (agentToFix == "average") {

                let totalXScore = 0;

                for (let agent of agents) {
                    let eachXScore = agent.getScore(false);
                    totalXScore += parseFloat(eachXScore[1]);
                }

                let averageXScore = totalXScore / agents.length;

                offsetX = p.width / 6 - averageXScore + 100;
            }            

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
            let groundStartX = groundPosition.x + offsetX - 1000;  // Adjust for camera offset
            let groundEndX = groundStartX + canvasWidth * 1000;  // Length of ground
            p.line(groundStartX, groundPosition.y - 10, groundEndX, groundPosition.y);

            calculateFPS(p);

            let agentsToRender = new Set(randomlySelectedAgents);  // Use a Set to ensure uniqueness

            // Ensure trailingAgent and leadingAgent are the last elements in the set
            if (agentsToRender.has(trailingAgent)) {
                agentsToRender.delete(trailingAgent);
            }
            if (agentsToRender.has(leadingAgent)) {
                agentsToRender.delete(leadingAgent);
            }

            agentsToRender.add(trailingAgent);
            agentsToRender.add(leadingAgent);

            let currentTime = p.millis();

            //console.log(currentTime, lastUIUpdateTime);
            if (currentTime - lastUIUpdateTime > UIUpdateInterval) {

                topScoreAgent = getHighestScore();

                // Display the score of the leading agent
                leadingAgentScores = leadingAgent.getScore(false);
                leadingAgentScore = leadingAgentScores[0];
                leadingAgentXScore = leadingAgentScores[1];
                leadingAgentYScore = leadingAgentScores[2];
                leadingAgentMovementScore = leadingAgentScores[3];
                leadingAgentWeightPenalty = leadingAgentScores[4];

                // Display the score of the trailing agent
                trailingAgentScores = trailingAgent.getScore(false);
                trailingAgentScore = trailingAgentScores[0];
                trailingAgentXScore = trailingAgentScores[1];
                trailingAgentYScore = trailingAgentScores[2];
                trailingAgentMovementScore = trailingAgentScores[3];
                trailingAgentWeightPenalty = trailingAgentScores[4];

                // Display the score of the highest scoring
                topScoreAgentScores = topScoreAgent.getScore(false);
                topScoreAgentScore = topScoreAgentScores[0];
                topScoreAgentXScore = topScoreAgentScores[1];
                topScoreAgentYScore = topScoreAgentScores[2];
                topScoreAgentMovementScore = topScoreAgentScores[3];
                topScoreAgentWeightPenalty = topScoreAgentScores[4];

                let totalScore = 0;
                for (let agent of agents) {
                    let eachScore = agent.getScore(false);
                    totalScore += parseFloat(eachScore[0]);
                }

                averageScore = totalScore / agents.length;

                displayedTimeLeft = (simulationLength - tickCount) * (1 / simulationSpeed);

                // Reset the last update time
                lastUIUpdateTime = currentTime;
            }

            // Render the FPS, Gen No, and Time Left
            p.fill(0);  // Black color for the text
            p.textSize(18);  // Font size
            p.text(`FPS: ${displayedFPS}`, 10, 20);
            p.text(`Generation: ${genCount}`, 10, 50);
            p.text(`Time Left: ${displayedTimeLeft.toFixed(0)} seconds`, 10, 80);
            p.text(`Top Score: ${topScoreEver.toFixed(2)}`, 10, 110);

            if (averageScore > - 10) {
                p.text(`Average Score: ${averageScore.toFixed(2)}`, 10, 140);
            } else {
                p.text(`Average Score: 0`, 10, 140);
            }

            p.text(`Distinct Population groups: ${numGroups}`, 10, 170);
            const circleDiameter = 20;
            // Render clickable circles for each group
            for (let i = 0; i < numGroups + 1; i++) {
                if (i == numGroups) {
                    p.fill(255);
                    p.ellipse(50 + i * (circleDiameter + 10), 200, circleDiameter);
                } else {
                    p.fill(GROUP_COLORS[i]);
                    p.ellipse(50 + i * (circleDiameter + 10), 200, circleDiameter);
                }
            }
            // Check for clicks on the circles to select a color
            p.mousePressed = function () {
                for (let i = 0; i < numGroups + 1; i++) {
                    let x = 50 + i * (circleDiameter + 10);
                    let y = 200;
                    let d = p.dist(p.mouseX, p.mouseY, x, y);
                    if (i == numGroups) {
                        if (d < circleDiameter / 2) {
                            selectedColor = null;
                            break;
                        }
                    } else {
                        if (d < circleDiameter / 2) {
                            selectedColor = [i];
                            break;
                        }
                    }
                }
            };
            p.fill(0);
            p.text(`Select a colour above to filter that group, or white to clear`, 10, 230);
            p.text(`Agents on screen: ${agentsToRender.size}`, 10, 260);
            p.text(`Agents in simulation: ${agents.length}`, 10, 290);

            if (!simulationStarted) {
                p.fill(255, 0, 0);
                p.text(`${currentProcess}`, 10, 350);
            }
            else {
                p.fill(0, 255, 0);
                p.text(`Agents can go!`, 10, 350);
            }

            p.textSize(16);  // Font size
            if (leadingAgentMovementScore > - 1) {
                p.fill(GROUP_COLORS[topScoreAgent.group]);
                p.text(`Top Scoring Agent: ${topScoreAgentScore} (X Score: ${topScoreAgentXScore} + Y Score: ${topScoreAgentYScore} + Joint Movement Score: ${topScoreAgentMovementScore})`, 10, groundY + 30);  // Displaying the score just below the ground
            }

            if (leadingAgentMovementScore > - 1) {
                p.fill(GROUP_COLORS[leadingAgent.group]);
                p.text(`Leading Agent Score: ${leadingAgentScore} (X Score: ${leadingAgentXScore} + Y Score: ${leadingAgentYScore} + Joint Movement Score: ${leadingAgentMovementScore})`, 10, groundY + 50);  // Displaying the score just below the ground
            }

            if (trailingAgentMovementScore > - 1) {
                p.fill(GROUP_COLORS[trailingAgent.group]);
                p.text(`Trailing Agent Score: ${trailingAgentScore} (X Score: ${trailingAgentXScore} + Y Score: ${trailingAgentYScore} + Joint Movement Score: ${trailingAgentMovementScore})`, 10, groundY + 70);  // Displaying the score just below the ground
            }

            if (showNeuralNetwork == true) {
                if (agentToFix == "trailer") {
                    p.text(`Showing Trailing Agents Brain`, 170, 20);
                    // Render NN for leading agent
                    p.fill(GROUP_COLORS[trailingAgent.group]);
                    trailingAgent.renderNN(p, canvasWidth - 1000, (canvasHeight / 2) - 80, tickCount);
                } else {
                    p.text(`Showing Leading Agents Brain`, 170, 20);
                    // Render NN for leading agent
                    p.fill(GROUP_COLORS[leadingAgent.group]);
                    leadingAgent.renderNN(p, canvasWidth - 1000, (canvasHeight / 2) - 80, tickCount);
                }
            }

            if (agentsToRender.size > 1) {
                if (selectedColor === null) {
                    for (let agent of agentsToRender) {
                        if (agent) {
                            // Only render agents from agentsToRender list
                            let agentOffsetX = offsetX - agent.startingX;
                            agent.render(p, agentOffsetX);
                        }
                    }
                } else {
                    for (let agent of agents) {
                        if (agent) {
                            // Only render agents belonging to the selected color
                            if (agent.group == selectedColor) {
                                let agentOffsetX = offsetX - agent.startingX;
                                agent.render(p, agentOffsetX);
                            }
                        }
                    }
                }
            }
            p.fill(0);
        }
    };
};

function areAllAgentsStable() {
    const stabilityThreshold = 0.001;  // Define a small threshold value for stability
    const stabilityFrames = 240;  // Number of frames to wait before confirming stability

    let allAgentsStable = true;

    for (let agent of agents) {
        if (agent.mainBody) {
            if (Math.abs(agent.mainBody.getLinearVelocity()) > stabilityThreshold) {
                allAgentsStable = false;
                break;
            }
        }
    }

    if (allAgentsStable) {
        stabilityCounter++;
        if (stabilityCounter >= stabilityFrames) {
            stabilityCounter = 0;  // Reset counter
            return true;
        }
    } else {
        stabilityCounter = 0;  // Reset counter if any agent is not stable
    }

    return false;
}

function initializeSketchBox2D(stageProperties) {
    canvasWidth = stageProperties.width;
    canvasHeight = stageProperties.height;
    groundY = stageProperties.groundY;
    popSize = stageProperties.numAgents;
    GravityStrength = stageProperties.gravity;
    FrictionStrength = stageProperties.fiction;
    simulationLength = stageProperties.simulationLength;
    renderedAgents = stageProperties.renderedAgents;
    simulationSpeed = stageProperties.simSpeed;
    topPerformerNo = stageProperties.topPerformerNumber / 100;
    delay = stageProperties.delay;
    BATCH_SIZE = stageProperties.batchSize;
    showNeuralNetwork = stageProperties.showNN;
    agentToFix = stageProperties.agentInCentre;
    TOURNAMENT_SIZE = stageProperties.tournamentSize;
    CROSS_GROUP_PROBABILITY = stageProperties.migrationRate;
    MIN_GROUP_SIZE = stageProperties.minPopGroupSize;
    MAX_GROUP_SIZE = stageProperties.maxPopGroupSize;
    UIUpdateInterval = stageProperties.uiRefreshRate;
    SOME_DELAY_FRAME_COUNT = stageProperties.muscleDelay;
    MUSCLE_BATCH_SIZE = stageProperties.muscleBatch;
    muscleUpdateFrames = stageProperties.totalMuscleUpdateTime;
    velocityIterations = stageProperties.velocityIteration;
    positionIterations = stageProperties.positionIteration;
    physicsGranularityMultiplier = stageProperties.physicsGranularityMultipliers;

    frameCountSinceLastFPS = 0;
    lastFPSCalculationTime = 0;
    tickCount = 0;
    displayedTimeLeft = 0;
    currentProcess = "Initializing world!";

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

function toggleNNRender(showNN) {
    showNeuralNetwork = showNN;
    console.log("toggling NN render");
}

function updateSimulation(stageProperties) {
    simulationLength = stageProperties.simulationLength;
    renderedAgents = stageProperties.renderedAgents;
    simulationSpeed = stageProperties.simSpeed;
    topPerformerNo = stageProperties.topPerformerNumber / 100;
    delay = stageProperties.delay;
    BATCH_SIZE = stageProperties.batchSize;
    showNeuralNetwork = stageProperties.showNN;
    agentToFix = stageProperties.agentInCentre;
    TOURNAMENT_SIZE = stageProperties.tournamentSize;
    CROSS_GROUP_PROBABILITY = stageProperties.migrationRate;
    MIN_GROUP_SIZE = stageProperties.minPopGroupSize;
    MAX_GROUP_SIZE = stageProperties.maxPopGroupSize;
    UIUpdateInterval = stageProperties.uiRefreshRate;
    SOME_DELAY_FRAME_COUNT = stageProperties.muscleDelay;
    MUSCLE_BATCH_SIZE = stageProperties.muscleBatch;
    muscleUpdateFrames = stageProperties.totalMuscleUpdateTime;
    velocityIterations = stageProperties.velocityIteration;
    positionIterations = stageProperties.positionIteration;
    physicsGranularityMultiplier = stageProperties.physicsGranularityMultipliers;
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
    this.index = agentNo;
    this.group = null;
    // console.log("a new agent, index: " + this.index);
    let mainBodyRadius = 20;
    this.startingX = 100 + 50 * this.index;
    // let startingX = 100;
    let startingY = 650;
    // this.jointMaxMove = maxJointMovement;  // Temporary
    // this.agentMutationRateLocal = agentMutationRate; // Temporary
    this.muscleUpdateCount = 0;
    //    this.mainBody = createMainBody(world, this.startingX, startingY, mainBodyRadius, agentNo);
    this.mainBody = createMainBody(world, this.startingX, startingY, mainBodyRadius, agentNo);
    this.position = this.mainBody.getPosition();

    this.limbs = [];
    this.muscles = [];
    this.joints = [];

    this.limbWidth = 10; // Example limb width
    this.limbLength = 40; // Example limb length
    let smallestAngle;
    let largestAngle;
    if (jointMaxMove != 0) {
        smallestAngle = -(Math.PI / jointMaxMove);
        largestAngle = Math.PI / jointMaxMove;
    } else {
        smallestAngle = 360;
        largestAngle = 360;
    }

    let nnConfig;

    for (let i = 0; i < numLimbs; i++) {
        let angle = (i * 2 * Math.PI) / numLimbs;
        // let limbX = this.startingX + Math.cos(angle) * (mainBodyRadius + limbLength);
        let limbX = this.startingX + Math.cos(angle) * (mainBodyRadius + this.limbLength);
        let limbY = startingY + Math.sin(angle) * (mainBodyRadius + this.limbLength);

        let limb = createLimb(world, limbX, limbY, this.limbWidth, this.limbLength, angle - Math.PI / 2, agentNo, i);
        this.limbs.push(limb);

        // Calculate local anchor for bodyA (main body)
        let localAnchorA = planck.Vec2(
            mainBodyRadius * Math.cos(angle),
            mainBodyRadius * Math.sin(angle)
        );

        // Calculate local anchor for bodyB (limb) before rotation
        let x = 0;
        let y = -this.limbLength / 2; // Assuming the limb's anchor is at the top edge

        // Calculate the point after rotation
        let localAnchorB = planck.Vec2(0, -this.limbLength / 2);

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

    this.weightPenaltyCache = null;
    this.weightPenaltyCounter = 0;

    this.getWeightPenalty = function () {
        this.weightPenaltyCounter++;
        // Update this score penalty only a few times, not exact as this is not called every frame
        let allWeightTensors = this.brain.getWeights().filter((_, idx) => idx % 2 === 0);
        let allWeights = allWeightTensors.flatMap(tensor => Array.from(tensor.dataSync()).map(Math.abs)); // map to absolute values
        let averageAbsWeight = allWeights.reduce((sum, weight) => sum + weight, 0) / allWeights.length;

        this.weightPenaltyCache = averageAbsWeight;

        return this.weightPenaltyCache;
    }

    // Initialize previousJointAngles to starting angles
    this.previousJointAngles = Array(this.numLimbs).fill(0).map((_, i) => this.joints[i].getJointAngle());

    // Initialize totalJointMovementReward to 0
    this.totalJointMovementReward = 0;

    this.getJointMovementReward = function () {
        let totalChange = 0;
        for (let i = 0; i < this.joints.length; i++) {
            let currentAngle = this.joints[i].getJointAngle();
            let change = Math.abs(currentAngle - this.previousJointAngles[i]);
            totalChange += change;

            // Update the previous angle for next time
            this.previousJointAngles[i] = currentAngle;
        }

        // Exponential decay for the reward. You can adjust the decay factor as needed.
        let decayFactor = 0.99;
        let currentReward = totalChange * decayFactor ** totalChange;

        // Accumulate joint movement reward
        this.totalJointMovementReward += currentReward;

        return this.totalJointMovementReward;
    };

    this.totalXMovementReward = 0;

    // Initialize previousXPos to starting x-position
    this.previousXPos = this.startingX;

    this.getScore = function (roundOver) {

        // Calculate change in x-position
        let deltaX = this.position.x - this.previousXPos;

        let currentXReward;

        if (displayedTimeLeft > 1) {
            let TimeFactor = 1 + this.muscleUpdateCount / simulationLength;
            // currentXReward = deltaX * TimeFactor * 2;  // Linier growth of x reward
            // currentXReward = deltaX ** TimeFactor ** 2; // non linier, 
             currentXReward = deltaX * Math.exp(TimeFactor - 1);
        } else {
            currentXReward = 0;
        }

        // Accumulate x movement reward
        this.totalXMovementReward += currentXReward;

        // Update the previous x position for next time
        this.previousXPos = this.position.x;

        // Old simple X score calculation
        // let XPosScore = (Math.floor(this.position.x - this.startingX) * 1);

        let YPosScore = (Math.floor(startingY - this.position.y + 50) * 1);

        let jointMovementReward = (this.getJointMovementReward() * 10 / numLimbs); // Adjust multiplier if needed
        let weightPenalty;
        if (roundOver) {
            weightPenalty = this.getWeightPenalty() * 200;
            // console.log("weight penalty: ",weightPenalty);
        } else {
            weightPenalty = 0;
        }

        this.Score = this.totalXMovementReward + YPosScore + jointMovementReward - weightPenalty;

        if (this.Score > topScoreEver) {
            topScoreEver = this.Score;
        }

        return [
            this.Score.toFixed(2),
            this.totalXMovementReward.toFixed(2),
            YPosScore.toFixed(2),
            jointMovementReward.toFixed(2),
            weightPenalty.toFixed(2)
        ];
    };

    this.render = function (p, offsetX) {
        // Set the fill color based on group
        p.fill(GROUP_COLORS[this.group]);
        p.stroke(0);
        // Render the main body
        if (this.mainBody) {
            let mainPos = this.position;
            let mainAngle = this.mainBody.getAngle();
            p.push();
            p.translate(mainPos.x + offsetX, mainPos.y);  // Added offsetX
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
                p.translate(limbPos.x + offsetX, limbPos.y);  // Added offsetX
                p.rotate(limbAngle);
                p.rect(-this.limbWidth / 2, -this.limbLength / 2, this.limbWidth, this.limbLength);
                p.pop();
            }
        }

        // Render the joints
        for (let i = 0; i < numLimbs; i++) {
            if (this.joints[i]) {
                let jointPos = this.joints[i].getAnchorA();
                // Check if the current joint's index is within the jointColors array length
                if (i < JOINT_COLORS.length) {
                    p.fill(JOINT_COLORS[i]);  // Set the fill color to the corresponding color from the jointColors array
                } else {
                    p.fill(0, 255, 0);  // Default fill color if there isn't a corresponding color in the array
                }
                p.ellipse(jointPos.x + offsetX, jointPos.y, 7, 7);  // Added offsetX
            }
        }
        // Render second set of joint anchors for testing
        //for (let i = 0; i < numLimbs; i++) {
        //    if (this.joints[i]) {
        //        let jointPos = this.joints[i].getAnchorB();
        //        // Check if the current joint's index is within the jointColors array length
        //        if (i < jointColors.length) {
        //            p.fill(jointColors[i]);  // Set the fill color to the corresponding color from the jointColors array
        //        } else {
        //            p.fill(0, 255, 0);  // Default fill color if there isn't a corresponding color in the array
        //        }
        //        p.ellipse(jointPos.x + offsetX, jointPos.y, 3, 3);  // Added offsetX
        //    }
        //}
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
    // body.setUserData("Agent " + agentNo + " Main Body");
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

    // Assign a negative group index based on the agent number
    // This ensures that limbs of the same agent will never collide with each other
    let groupIndex = -agentNo;

    let fixtureDef = {
        shape: shape,
        density: 0.1,
        filterCategoryBits: CATEGORY_AGENT_LIMB,
        filterMaskBits: CATEGORY_GROUND,  // Only allow collision with the ground
        filterGroupIndex: groupIndex      // Set the group index
    };
    body.createFixture(fixtureDef);
    // body.setUserData("Agent " + agentNo + " Limb " + limbNo);

    return body;
}

function createRevoluteJoint(world, bodyA, bodyB, localAnchorA, localAnchorB, lowerAngle, upperAngle) {
    let limiter = true;
    if (jointMaxMove == 0) {
        limiter = false;
    }
    let jointDef = {
        bodyA: bodyA,
        bodyB: bodyB,
        localAnchorA: localAnchorA,
        localAnchorB: localAnchorB,
        lowerAngle: lowerAngle,
        upperAngle: upperAngle,
        enableLimit: limiter,
        motorSpeed: 0.0,
        maxMotorTorque: torque,
        enableMotor: true
    };

    return world.createJoint(planck.RevoluteJoint(jointDef, bodyA, bodyB));
}

function initializeAgentsBox2D(agentProperties) {
    limbsPerAgent = agentProperties.numLimbs;
    torque = agentProperties.musculeTorque;
    MAX_ADJUSTMENT = agentProperties.maxJointSpeed;
    jointMaxMove = agentProperties.maxJointMoveDivider;
    brainDecay = agentProperties.brainDecayOverTime;
    inputsJointAngle = agentProperties.inputJointAngle;
    inputsJointSpeed = agentProperties.inputJointSpeed;
    inputsAgentPos = agentProperties.inputAgentPos;
    inputsAgentV = agentProperties.inputAgentV;
    inputsScore = agentProperties.inputScore;
    inputsOrientation = agentProperties.inputOrientation;
    inputsTimeRemaining = agentProperties.inputTimeRemaining;
    inputsGroundSensors = agentProperties.inputGroundSensors;
    inputsDistanceSensors = agentProperties.inpusDistanceSensors;
    agentMutationRate = agentProperties.offspringMutationRate;
    genCount = 1;
    simulationStarted = false;
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

            //// Destroy the limbs
            //for (let limb of agent.limbs) {
            //    if (limb) { // Check if body exists and is in the world
            //        world.destroyBody(limb);
            //    }
            //}

            //// Destroy the main body
            //if (agent.mainBody) {
            //    world.destroyBody(agent.mainBody);
            //}

            agent.joints = [];
            agent.limbs = [];
            agent.mainBody = null;
        }
    }

    // Calculate the number of groups
    numGroups = Math.max(1, Math.ceil(popSize / MAX_GROUP_SIZE));
    let agentsPerGroup = Math.ceil(popSize / numGroups);

    // Adjust if the population is too small
    if (popSize <= MIN_GROUP_SIZE) {
        numGroups = 1;
        agentsPerGroup = popSize;
    }

    agents = [];  // Reset the agents array
    currentProcess = "Initializing first generation!";
    // Initialize agents in batches
    for (let i = 0; i < popSize; i += BATCH_SIZE) {
        initializeAgentBatch(i, Math.min(i + BATCH_SIZE, popSize), agentsPerGroup);
    }

    waitForFirstInitializationCompletion();

    displayedTimeLeft = (simulationLength - tickCount) * (1 / simulationSpeed);
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
        // console.log("initializeAgent, making agent: ", i);
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

            // Select few random agents
            for (let i = 0; i < renderedAgents; i++) {
                let randomIndex = Math.floor(Math.random() * groupAgents.length);
                randomlySelectedAgents.push(groupAgents[randomIndex]);
                // console.log("adding random agent to render list, group: " + groupId);
            }
        }

        offsetX = 0;

    } else {
        // If the agents not initialised, wait for some time and check again
        setTimeout(waitForFirstInitializationCompletion, 100); // Checking every 100ms
    }
}

function getLeadingAgent(frameCounter) {
    if (agents.length === 0) return null;

    if (frameCounter % 30 === 0) {

        // Truncate randomlySelectedAgents to keep initialised picks
        randomlySelectedAgents = randomlySelectedAgents.slice(0, numGroups * renderedAgents);

        // Create an array of the leading agents from each group
        let leadingAgents = [];
        for (let groupId = 0; groupId < numGroups; groupId++) {
            let groupAgents = agents.filter(agent => agent.group === groupId);

            // Select leading agent
            let leadingAgent = groupAgents.sort((a, b) => parseFloat(b.getScore(false)[0]) - parseFloat(a.getScore(false)[0]))[0];

            leadingAgents.push(leadingAgent);
        }

        randomlySelectedAgents.push(...leadingAgents);

    }

    // Shuffle the leadingAgents array
    //function shuffleArray(array) {

    //    // Truncate randomlySelectedAgents to keep initialised picks
    //    randomlySelectedAgents = randomlySelectedAgents.slice(0, numGroups * renderedAgents);

    //    for (let i = array.length - 1; i > 0; i--) {
    //        const j = Math.floor(Math.random() * (i + 1));
    //        [array[i], array[j]] = [array[j], array[i]];
    //    }

    //    // Push the shuffled leading agents to randomlySelectedAgents
    //    randomlySelectedAgents.push(...leadingAgents);
    //}
    //if (frameCounter % 100 === 0) {
    //    shuffleArray(leadingAgents);
    //}


    return agents.reduce((leading, agent) =>
        (agent.position.x - agent.startingX > leading.position.x - leading.startingX ? agent : leading),
        agents[0]
    );
}

function getLastAgent() {
    if (agents.length === 0) return null;

    return agents.reduce((trailing, agent) =>
        (agent.position.x - agent.startingX < trailing.position.x - trailing.startingX ? agent : trailing),
        agents[0]
    );
}

function getHighestScore() {
    if (agents.length === 0) return null;

    agents.sort((a, b) => parseFloat(b.getScore(false)[0]) - parseFloat(a.getScore(false)[0]));

    return agents[0];
}

function endSimulation(p) {
    // p.noLoop();
    isInitializationComplete = false;
    simulationStarted = false;
    currentProcess = "Sorting agents by score!";
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

    // Adds event listener for collisions, console logged. Commented as it seems fairly expensive, but might just be console getting overloaded.  Will need to uncomment UserData setting for each body to use again
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
    // groundBody.setUserData("Ground");
    // Define the ground shape and add it as a fixture to the ground body
    const groundShape = planck.Box(canvasWidth * popSize, 10);
    let fixtureDef = {
        shape: groundShape,
        filterCategoryBits: CATEGORY_GROUND,
        filterMaskBits: CATEGORY_AGENT_BODY | CATEGORY_AGENT_LIMB 
    }
    groundBody.createFixture(fixtureDef); // Static bodies like the ground don't need a density, it's ignored
}

/*            Neural Network Functions                     */

function NeuralNetworkConfig(numLimbs) {
    // Calculate the total number of input nodes
    this.inputNodes = 0;
    if (inputsJointAngle) this.inputNodes += numLimbs;
    if (inputsJointSpeed) this.inputNodes += numLimbs;
    if (inputsGroundSensors) this.inputNodes += numLimbs;
    if (inputsAgentPos) this.inputNodes += 2;
    if (inputsAgentV) this.inputNodes += 2;
    if (inputsScore) this.inputNodes += 1;
    if (inputsOrientation) this.inputNodes += 1;
    if (inputsTimeRemaining) this.inputNodes += 1;
    if (inputsDistanceSensors) this.inputNodes += 8;

    // Configure the rest of the neural network
    this.hiddenLayers = [{ nodes: 15, activation: 'relu' }, { nodes: 10, activation: 'relu' }];
    this.outputNodes = numLimbs;
    this.mutationRate = 0.01;
    //this.mutationRate = Math.random();  // A random mutation rate between 0 and 1
}

function createNeuralNetwork(config) {
    const model = tf.sequential();

    // Input layer
    model.add(tf.layers.dense({
        units: config.hiddenLayers[0].nodes,
        activation: config.hiddenLayers[0].activation,
        inputShape: [config.inputNodes],
        biasInitializer: 'randomNormal',  // bias initializer
        kernelInitializer: 'heNormal'  // weight initializer
    }));

    // Hidden layers
    for (let i = 0; i < config.hiddenLayers.length; i++) {
        model.add(tf.layers.dense({
            units: config.hiddenLayers[i].nodes,
            activation: config.hiddenLayers[i].activation,
            biasInitializer: 'randomNormal',  // bias initializer
            kernelInitializer: 'heNormal'  // weight initializer
        }));
    }

    // Output layer
    model.add(tf.layers.dense({ units: config.outputNodes, activation: 'tanh' })); 

    return model;
}

function nextGeneration(p) {
    usedIndices = new Set();
    let newAgents = [];
    let groupAgents;
    let topPerformersCount;

    // calculate average network 'pattern'
    let averageBrain = calculateAllAverageDistances();

    // Sort in descending order of score, including the bonus for being different from the average.
    agents.sort((a, b) => {
        const aScore = a.getScore(true)[0];
        const bScore = b.getScore(true)[0];
        const aDistance = distanceToAverage(a, averageBrain[a.group]);
        const bDistance = distanceToAverage(b, averageBrain[b.group]);

        // Adjust the score with the distance to the average brain
        const aTotal = aScore + aDistance ** 1 * 1; // playing with differnt multipliers
        const bTotal = bScore + bDistance ** 1 * 1;

        // Sort in descending order
        return bTotal - aTotal;
    });

    // agents.sort((a, b) => parseFloat(b.getScore()[0]) - parseFloat(a.getScore()[0]));

    //console.log("Top Agents this round!");
    //for (let i = 0; i < Math.round(topPerformerNo * popSize); i++) {
    //    console.log(agents[i].index);
    //}
    currentProcess = "Starting selection process!";
    for (let groupId = 0; groupId < numGroups; groupId++) {

        groupAgents = agents.filter(agent => agent.group === groupId); // Filter agents of this group

        topPerformersCount = Math.floor(topPerformerNo * groupAgents.length);
        topPerformersCount = Math.max(topPerformersCount, 2); // Ensure at least 2 top performers are selected

        // Create new agents, but assign them the brains of previous top performers from the group
        createTopPerformers(groupAgents, topPerformersCount, newAgents);

        // Generate offspring within the group
        generateOffspring(groupAgents, newAgents, groupId, averageBrain, topPerformersCount);
    }

    waitForInitializationCompletion(newAgents);

    console.log('Restarting simulation with evolved agents!');

    // Reset simulation
    // await new Promise(resolve => setTimeout(resolve, 1000));
    displayedTimeLeft = (simulationLength - tickCount) * (1 / simulationSpeed);
    stabilityCounter = 0;
    tickCount = 0;
    nextBatchFrame = 1;
    currentPhysicsBatch = 0;
    // p.loop();
    genCount++;
}

// Get the average weights accross the network.
function calculateAllAverageDistances() {
    let averageWeights = [];

    for (let groupId = 0; groupId < numGroups; groupId++) {

        let groupAgents = agents.filter(agent => agent.group === groupId);
        let numAgents = groupAgents.length;

        if (numAgents === 0) {
            throw new Error("No agents to calculate average weights");
        }

        let firstAgentWeights = groupAgents[0].brain.getWeights().flatMap(tensor => Array.from(tensor.dataSync()));
        let averageWeightsGroup = new Array(firstAgentWeights.length).fill(0);

        groupAgents.forEach(agent => {
            let agentWeights = agent.brain.getWeights().flatMap(tensor => Array.from(tensor.dataSync()));

            if (agentWeights.length !== firstAgentWeights.length) {
                throw new Error("Agents have neural networks of different sizes");
            }

            for (let i = 0; i < agentWeights.length; i++) {
                averageWeightsGroup[i] += agentWeights[i];
            }
        });

        for (let i = 0; i < averageWeightsGroup.length; i++) {
            averageWeightsGroup[i] /= numAgents;
        }
        averageWeights.push(averageWeightsGroup);
    }
    return averageWeights;
}


// Function to calculate the Euclidean distance of an agent's weights and biases to the population's average
function distanceToAverage(agent, averageWeights) {
    let agentWeights = agent.brain.getWeights().flatMap(tensor => Array.from(tensor.dataSync()));

    if (agentWeights.length !== averageWeights.length) {
        throw new Error("Agent has neural network of different size compared to population average");
    }

    let sum = 0;
    for (let i = 0; i < agentWeights.length; i++) {
        sum += Math.pow(agentWeights[i] - averageWeights[i], 2);
    }
    // console.log(sum);
    return Math.sqrt(sum);
}

// Update the mutation rate if NN's converge
function updateMutationRate(oldRate, averageBrain) {
    currentProcess = "Altering mutation rate if agents brains converge!";
    let stdDevDistance = stdDevDistanceToAverageBrain(agents, averageBrain);

    // Check if stdDevDistance is non-zero to avoid division by zero
    if (stdDevDistance > 0) {
        // Set the rate as the inverse of stdDevDistance, scaled by 1/40
        newRate = 0.025 / stdDevDistance;

        // Clamp the rate to be within [0.1, 0.4].  Should find a way to replace 0.1 with the users selection
        newRate = Math.min(0.4, Math.max(0.1, newRate));
    } else {
        // If stdDevDistance is zero, it means all agents are identical, 
        // so set a high mutation rate to increase diversity
        newRate = 0.4;
    }

    // console.log("Updated Mutation Rate: ", newRate, "Deviation Between Brains: ", stdDevDistance);
    return newRate;
}

function stdDevDistanceToAverageBrain(allAgents, averageBrain) {
    let distances = [];
    let numAgents = allAgents.length;
    let avgDistance = averageDistanceToAverageBrain(allAgents, averageBrain);

    allAgents.forEach(agent => {
        let distance = distanceToAverage(agent, averageBrain);
        distances.push(Math.pow(distance - avgDistance, 2));
    });

    let sum = distances.reduce((a, b) => a + b, 0);
    return Math.sqrt(sum / numAgents);
}

function averageDistanceToAverageBrain(allAgents, averageBrain) {
    let sumDistance = 0;
    let numAgents = allAgents.length;

    allAgents.forEach(agent => {
        sumDistance += distanceToAverage(agent, averageBrain);
    });

    return sumDistance / numAgents;
}

// Create top performers for the next generation
function createTopPerformers(groupAgents, topPerformersCount, newAgents) {
    currentProcess = "Keeping top performers!";
    for (let j = 0; j < topPerformersCount; j++) {
        let oldAgent = groupAgents[j];
        usedIndices.add(oldAgent.index);
        let newAgent = new Agent(oldAgent.numLimbs, oldAgent.index, oldAgent.brain);
        newAgent.group = oldAgent.group;
        newAgents.push(newAgent);
    }
}

// Function to generate offspring for the next generation
function generateOffspring(groupAgents, newAgents, groupId, averageBrain, topPerformerNumber) {
    currentProcess = "Creating offspring from weighted random parents!";
    function createChildAgentBatch(startIndex) {
        if (newAgents.filter(agent => agent.group === groupId).length >= groupAgents.length) {
            // All agents for this group have been created
            return;
        }

        if (newAgents.filter(agent => agent.group === groupId).length >= topPerformerNumber) {
            let currentGroupAgents = newAgents.filter(agent => agent.group === groupId).length;
            let numToCreate = Math.min(BATCH_SIZE, groupAgents.length - currentGroupAgents);
            for (let i = 0; i < numToCreate; i++) {
                let parent1 = selectAgent(groupAgents, agents);
                let parent2 = selectAgentWeighted(groupAgents, agents, parent1);

                // let childBrain = crossover(parent1, parent2);
                let childBrain = biasedArithmeticCrossover(parent1, parent2);

                // childBrain.mutationRate = updateMutationRate(this.mutationRate, averageBrain)

                // childBrain = mutate(childBrain, this.mutationRate);
                childBrain = gaussianMutation(childBrain, agentMutationRate);

                // Decay all weights in the brain by a small amount
                if (brainDecay) {
                    childBrain = decayWeights(childBrain);
                }

                let agentIndex = 0;

                // Find the next unused index
                while (usedIndices.has(agentIndex)) {
                    agentIndex++;
                }

                usedIndices.add(agentIndex);  // Mark this index as used
                let childAgent = new Agent(limbsPerAgent, agentIndex);
                // console.log("generateOffspring, making agent: ", agentIndex);

                childAgent.brain.dispose();
                childAgent.brain = childBrain;
                childAgent.group = groupId; // Assign group
                newAgents.push(childAgent);
            }
        }

        // Schedule the next batch
        if (startIndex + BATCH_SIZE < groupAgents.length) {
            setTimeout(() => createChildAgentBatch(startIndex + BATCH_SIZE), delay);
        }
    }

    createChildAgentBatch(0);
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
    return tournamentContestants.sort((a, b) => b.getScore(true) - a.getScore(true))[0];
}

function selectAgentWeighted(agentsLocal, allAgents, excludedAgent = null) {
    // Occasionally pick from the entire population
    if (Math.random() < CROSS_GROUP_PROBABILITY) {
        agentsLocal = allAgents;
    }

    let normalizedScores = [];
    let minScore = Math.min(...agentsLocal.map(agent => agent.getScore(true)));

    // Ensure all scores are positive
    let offsetScore = minScore < 0 ? Math.abs(minScore) : 0;

    let cumulativeSum = 0;
    for (let agent of agentsLocal) {
        if (agent !== excludedAgent) {
            let score = agent.getScore(true) + offsetScore;
            cumulativeSum += score;
            normalizedScores.push(cumulativeSum);
        }
    }

    let randomValue = Math.random() * cumulativeSum;
    // If the random value is greater than the current iterated score, take that agent
    for (let i = 0; i < normalizedScores.length; i++) {
        if (randomValue <= normalizedScores[i]) {
            return agentsLocal[i];
        }
    }
    // Should not reach here, but just in case
    return agentsLocal[0];
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
    newWeights.forEach(weight => weight.dispose()); // Dispose of these tensors manually.  Might not need as well as tf.tidy
    return childBrain;
}

function biasedArithmeticCrossover(agent1, agent2) {
    let childBrain = createNeuralNetwork(agent1.nnConfig);

    let score1 = agent1.getScore(true);
    let xScore1 = parseFloat(score1[0]);

    let score2 = agent2.getScore(true);
    let xScore2 = parseFloat(score2[0]);

    let totalScore = xScore1 + xScore2;

    if (Math.abs(totalScore) < 1e-5) {
        return childBrain;
    }

    let alpha = xScore1 / totalScore;
    let beta = xScore2 / totalScore;  // Calculated directly

    let newWeights = tf.tidy(() => {
        let agent1Weights = agent1.brain.getWeights();
        let agent2Weights = agent2.brain.getWeights();
        let newWeightList = [];
        for (let i = 0; i < agent1Weights.length; i++) {
            let weight1 = agent1Weights[i];
            let weight2 = agent2Weights[i];
            let newWeightValues = tf.add(tf.mul(weight1, alpha), tf.mul(weight2, beta));
            newWeightList.push(newWeightValues);
        }
        return newWeightList;
    });

    childBrain.setWeights(newWeights);
    newWeights.forEach(weight => weight.dispose()); // Dispose of these tensors manually. Might not need as well as tf.tidy
    // Validate weights (e.g., check for NaN, check range, etc.)

    return childBrain;
}


// Some persentage of weights in a network should be changed by a random amount betwee -0.05 and 0.05
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

// Gaussian version of my mutate function, allowing for small randomised changes to weights within a normal distribution
function gaussianMutation(childBrain, mutationRate) {
    let stdDeviation = 0.1;
    tf.tidy(() => {
        function mutateValues(values) {
            // Handle nested arrays (2D, 3D, ...)
            if (Array.isArray(values[0])) {
                for (let i = 0; i < values.length; i++) {
                    mutateValues(values[i]);
                }
            } else {
                // 1D array
                for (let i = 0; i < values.length; i++) {
                    if (Math.random() < mutationRate) {
                        let adjustment = randomGaussian(0, stdDeviation);
                        // console.log("making mutation from: ", values[i], "to: ", values[i] + adjustment);
                        values[i] += adjustment;
                    }
                }
            }
        }

        function randomGaussian(mean, sd) {
            // Using the Box-Muller transform to get a Gaussian random number
            let u1 = Math.random();
            let u2 = Math.random();
            let randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
            return mean + sd * randStdNormal;
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

// If enabled, decay all weights in the brain by a small multiplier to encourage new solutions to emerge.  Might make this selective, or remove already low values completely (pruning)
function decayWeights(brain, decayRate = 0.0001) {
    return tf.tidy(() => {
        let agentWeights = brain.getWeights();
        let newWeights = [];

        for (let tensor of agentWeights) {
            let decayedTensor = tensor.mul(tf.scalar(1.0 - decayRate));
            newWeights.push(decayedTensor);
        }

        brain.setWeights(newWeights);
        return brain;
    });
}



// Recursive function checking if agents have finished loading into world
function waitForInitializationCompletion(newAgents) {
    // Check if the condition is met
    if (newAgents.length >= popSize) {
        currentProcess = "New agents added to world!";

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

            // Select few random agents
            for (let i = 0; i < renderedAgents; i++) {
                let randomIndex = Math.floor(Math.random() * groupAgents.length);
                randomlySelectedAgents.push(groupAgents[randomIndex]);
                // console.log("adding random agent to render list, group: " + groupId);
            }
        }

        console.log('Number of tensors after restart:', tf.memory().numTensors, 'Tensor Mem after restart', tf.memory().numBytes);
        console.log("Number of bodies:", world.getBodyCount());
        console.log("Number of joints:", world.getJointCount());
        offsetX = 0;

    } else {
        // If the condition is not met, wait for some time and check again
        setTimeout(() => waitForInitializationCompletion(newAgents), 100); // Checking every 100ms for example
    }
}

function renderNeuralNetwork(p, nnConfig, agent, offsetX, offsetY, frameTracker) {
    let layerGap = 100; // horizontal space between layers
    let nodeGap = 30;   // vertical space between nodes
    let outputLabels;
    let allWeightTensors;
    let allWeights;
    let allBiasesTensors;
    let allBiases;

    p.fill(GROUP_COLORS[agent.group]);

    let inputLabels = [];

    if (inputsJointAngle) {
        inputLabels = inputLabels.concat(Array(agent.numLimbs).fill(null).map((_, idx) => `Joint Angle ${idx + 1}`));
    }

    if (inputsJointSpeed) {
        inputLabels = inputLabels.concat(Array(agent.numLimbs).fill(null).map((_, idx) => `Joint Speed ${idx + 1}`));
    }

    if (inputsAgentPos) {
        inputLabels.push("Agent's X", "Agent's Y");
    }

    if (inputsAgentV) {
        inputLabels.push("Velocity X", "Velocity Y");
    }

    if (inputsScore) {
        inputLabels.push("Score");
    }

    if (inputsOrientation) {
        inputLabels.push("Orientation");
    }

    if (inputsTimeRemaining) {
        inputLabels.push("Time Left");
    }

    if (inputsGroundSensors) {
        inputLabels = inputLabels.concat(Array(agent.numLimbs).fill(null).map((_, idx) => `Limb Sensor ${idx + 1}`));
    }

    if (inputsDistanceSensors) {
        for (let i = 0; i < 8; i++) {
            inputLabels.push(`Distance Sensor ${['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'][i]}`);
        }
    }

    // + displayedTimeLeft.toFixed(0)
    // `Time Left: ${displayedTimeLeft.toFixed(0)} seconds`

    //if (frameTracker % 30 === 0) {
        outputLabels = Array(nnConfig.outputNodes).fill(null).map((_, idx) => `Joint ${idx + 1}`);

        allWeightTensors = agent.brain.getWeights().filter((_, idx) => idx % 2 === 0);
        allWeights = allWeightTensors.flatMap(tensor => Array.from(tensor.dataSync()));

        allBiasesTensors = agent.brain.getWeights().filter((_, idx) => idx % 2 === 1);
        allBiases = allBiasesTensors.flatMap(tensor => Array.from(tensor.dataSync()));
    //}

    let currentWeightIndex = 0;
    let currentBiasIndex = 0;

    // First, render all the connections (lines)
    let x = offsetX;
    for (let i = 0; i < nnConfig.hiddenLayers.length + 2; i++) {
        let nodes = 0;
        if (i === 0) {
            nodes = nnConfig.inputNodes;
        } else if (i === nnConfig.hiddenLayers.length + 1) {
            nodes = nnConfig.outputNodes;
        } else {
            nodes = nnConfig.hiddenLayers[i - 1].nodes;
        }

        let startY = offsetY - ((nodes - 1) * nodeGap) / 2; // to center the nodes

        let currentLayerPositions = [];
        for (let j = 0; j < nodes; j++) {
            let y = startY + j * nodeGap;
            currentLayerPositions.push({ x: x, y: y });
        }

        // Draw connections
        if (i > 0) {
            for (let prevPos of previousLayerPositions) {
                for (let currentPos of currentLayerPositions) {
                    let weight = allWeights[currentWeightIndex];
                    let maxWeight = Math.max(...allWeights.map(Math.abs));
                    currentWeightIndex++;

                    let strokeWeightValue = mapWeightToStroke(weight, maxWeight);
                    //p.stroke(GROUP_COLORS[agent.group]);
                    p.strokeWeight(strokeWeightValue);
                    p.line(prevPos.x, prevPos.y, currentPos.x, currentPos.y);
                }
            }
        }

        previousLayerPositions = currentLayerPositions;
        x += layerGap;
    }

    // Then, render the nodes (on top of the lines)
    x = offsetX;
    for (let i = 0; i < nnConfig.hiddenLayers.length + 2; i++) {
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
            let maxBias = Math.max(...allBiases.map(Math.abs));
            let bias = allBiases[currentBiasIndex];
            currentBiasIndex++;

            // Check if it's the output layer and set fill color accordingly
            if (i === nnConfig.hiddenLayers.length + 1 && j < JOINT_COLORS.length) {
                p.fill(JOINT_COLORS[j]);
            } else {
                p.fill(GROUP_COLORS[agent.group]); // Default fill color
            }
            p.strokeWeight(0);
            let nodeSize = mapBiasToNodeSize(bias, maxBias);
            p.ellipse(x, y, nodeSize, nodeSize);

            // Add labels to the side of input and output nodes
            if (labels.length > 0) {
                p.textSize(12);
                if (i === 0) {
                    p.text(labels[j], x - 90, y + 4);
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
    p.strokeWeight(1); // Reset the default stroke weight
}

// Normalization function
function normalize(value, maxValue, minValue = 0) {
    if (minValue == maxValue) return 0.5;  // to prevent division by zero
    return (value - minValue) / (maxValue - minValue);
}

function mapWeightToStroke(weight, maxValue) {
    let normalizedWeight = normalize(Math.abs(weight), maxValue);
    return 0.0001 + normalizedWeight ** 3; // Assuming you want weights to range from 0.0001 to 0.1
}

function mapBiasToNodeSize(bias, maxValue) {
    let normalizedBias = normalize(Math.abs(bias), maxValue);
    return 5 + normalizedBias * 10; // Assuming you want biases to scale node size from 5 to 10
}

Agent.prototype.makeDecision = function (inputs) {
    return tf.tidy(() => {
        const output = this.brain.predict(tf.tensor([inputs])).dataSync();
        for (let i = 0; i < this.joints.length; i++) {
            let adjustment = output[i] * MAX_ADJUSTMENT; // Scales the adjustment based on the output
            this.joints[i].setMotorSpeed(adjustment);
        }
    });
};


Agent.prototype.collectInputs = function () {
    let inputs = [];

    // Constants for normalization
    const MAX_X = 500; //Approx based on observation
    const MAX_Y = 250;
    const MAX_VX = 500; //Approx based on observation
    const MAX_VY = 500;
    const MAX_SPEED = MAX_ADJUSTMENT;  // Assuming this is the maximum joint speed
    const MAX_SCORE = topScoreEver;  // Max Score equaling the top score makes sense, but means the range of this input will change over the simulation.
    const MAX_TIME = simulationLength / simulationSpeed;  // Maximum time in seconds

    // 1. Joint angles normalized to [-1, 1]
    if (inputsJointAngle) {
        for (let joint of this.joints) {
            let jointAngle = joint.getJointAngle() / Math.PI;
            inputs.push(jointAngle);
        }
    }
    if (inputsJointSpeed) {
        // 2. Joint speeds normalized based on MAX_ADJUSTMENT.  Temporally removed for simplicity
        for (let joint of this.joints) {
            let jointSpeed = joint.getJointSpeed() / MAX_SPEED;
            inputs.push(jointSpeed);
        }
    }

        let position = this.position;
    if (inputsAgentPos) {
        // 3. Agent's position (x,y) normalized based on assumed max values
        inputs.push((position.x - this.startingX) / MAX_X);
        inputs.push(position.y / MAX_Y);
    }

        let velocity = this.mainBody.getLinearVelocity();
    if (inputsAgentV) {
        // 4. Agent's velocity (x,y) normalized based on assumed max values for now
        inputs.push(velocity.x / MAX_VX);  // You may want to use a different max speed value here
        inputs.push(velocity.y / MAX_VY);  // You may want to use a different max speed value here
    }

    if (inputsScore) {
        // 5. Score normalized based on MAX_SCORE
        inputs.push(this.getScore() / MAX_SCORE); // I dont think this is actually useful to the agent
    }

    if (inputsOrientation) {
        // 6. Agent's orientation normalized to [-1, 1]
        inputs.push(this.mainBody.getAngle() / Math.PI);
    }

    if (inputsTimeRemaining) {
        // 7. Time remaining normalized to [0, 1]
        inputs.push(displayedTimeLeft / MAX_TIME);
    }

    if (inputsGroundSensors) {
        // 8. Check collision with ground for each limb and also measure distance to ground
        const GROUND_LEVEL = 700;  // y-coordinate of the ground
        const MAX_DISTANCE = 50;   // Max expected distance to the ground, for normalization

        for (let limb of this.limbs) {
            let angle = limb.getAngle();
            let halfHeight = this.limbLength / 2;

            let limbPosition = limb.getPosition();

            // Calculate the y-coordinate of the lowest point on the limb
            let lowestPointY = limbPosition.y + halfHeight * Math.abs(Math.cos(angle));

            // Check if the limb is touching the ground
            if (lowestPointY >= GROUND_LEVEL - 1) {
                inputs.push(-1);  // Collision detected
                // console.log("colission");
            } else {
                // Calculate distance to ground and normalize it
                let distanceToGround = (GROUND_LEVEL - lowestPointY) / MAX_DISTANCE;
                inputs.push(Math.min(distanceToGround, 1));  // Limit to 1
                // console.log("distance to ground from limb: ", distanceToGround, "lowest point: ", lowestPointY);
            }
        }
    }

    // console.log("agent inputs: position: ", (position.x - this.startingX) / MAX_X, position.y / MAX_Y, "Velocity: ", velocity.x / MAX_VX, velocity.y / MAX_VY, this.mainBody.getAngle() / Math.PI, displayedTimeLeft / MAX_TIME)
    return inputs;
};


Agent.prototype.updateMuscles = function () {
    let inputs = this.collectInputs();
    this.makeDecision(inputs);
    this.muscleUpdateCount++;
};

Agent.prototype.renderNN = function (p, offsetX, offsetY, frameTracker) {
    renderNeuralNetwork(p, this.nnConfig, this, offsetX, offsetY, frameTracker);
};