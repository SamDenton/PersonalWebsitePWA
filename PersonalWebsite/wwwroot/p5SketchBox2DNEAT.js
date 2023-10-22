// Variables specific to NEAT version

let liquidViscosityDecay, mapNo;
let MAX_ADJUSTMENT_TORQUE = 500000;
let offsetY = 0;
let simulationLengthModified = 0;
let showRayCasts = false;
let render = true;
let dragCoefficient; 
let singleUpdateCompleted = false;
let stabilised = false;
let updatesPerAgentStart = 1;
let framesPerUpdateStart = 5;
let updateCountStart = {};
let frameCountStart = {};
let agentIndexStart = 0;
let agentGenomePool = [];
let tempAgentGenomePool = [];
let tempAgentPool = [];
let randMap = 0;
let runCount = 0;
let fixedTimeStep = 1.0 / 60.0 * 1000;
let cachedLeadingAgent = null;
//let xScoreMult;
//let yScoreMult;
//let movementScoreMult;
//let explorationScoreMult;
//let sizeScoreMult;
//let startingEnergyBaseJS;
//let startingEnergyMassPowerJS;
//let startingEnergyBodyMassMultJS;
//let startingEnergyLimbMassMultJS;
//let energyUseForceSizeMultJS;
//let energyUseLimbSizeMultJS;
//let energyUseBrainSizeMultJS;
// let brainDecay, inputsJointAngle, inputsJointSpeed, inputsAgentPos, inputsAgentV, inputsScore, inputsOrientation, inputsTimeRemaining, inputsGroundSensors, inputsDistanceSensors, outputJointSpeed, outputJointTorque, outputBias, swimStrengthMultiplier, swimBiasMultiplier;

const GROUP_COLORS_NAMES = [
    'Traffic purple', 'Grass green', 'Yellow orange', 'Maize yellow', 'Quartz grey', 'Salmon range', 'Pearl black berry', 'Golden yellow', 'Pearl light grey', 'Red lilac',
    'Violet blue', 'Pure green', 'Light ivory', 'Patina green', 'Traffic yellow', 'Ocean blue', 'Pastel blue', 'Reed green', 'Luminous red', 'Turquoise blue',
    'Red Orange', 'Green', 'Very Dark Gray', 'Charcoal', 'Olive Drab', 'Very Dark Red', 'Blue', 'Magenta', 'Bright Yellow', 'Orange',
    'Teal Green', 'Strong Blue', 'Bright Magenta', 'Yellow', 'Brown', 'Gray', 'Dark Red', 'Cool Gray', 'Golden', 'Deep Red'
];

let wallBodies = [];
let duplicateWalls = [];

/* 
Ideas:      
            -I want to have the environment both configurable on startup, and for it to get more challenging over generations
            -I want to save agents, either individuals or populations, to re-use later.  Would be good to have a property tracking agent history, its own top score, what the parameters where when it got that score, etc.
            -I want to evolve the inputs and outputs of the network, from a selection of available
            -Look at different limb types (wheels, single limb, jointed/double limb, wing(?), balance)
            -Further explore options for regularization and pruning.
*/

//SketchNEAT is called once to start the simulation, and it then calls draw() repeatedly.
let sketchNEAT = function (p) {

    // Variables for rendering.
    nextBatchFrame = 0;
    fixedTimeStep = (1.0 / simulationSpeed) * 1000; // 'simulationSpeed' updates per second for physics
    let accumulator = 0;
    let lastTime = 0;
    let leadingAgent;
    let currentPhysicsBatch = 0;
    let startingTickCounter = 0;
    let particles = [];

    let trailingAgent = agents[agents.length - 1];
    let topScoreAgent = agents[0];
    let leadingAgentScores, leadingAgentScore, leadingAgentXScore, leadingAgentYScore, leadingAgentMovementScore;
    let trailingAgentScores, trailingAgentScore, trailingAgentXScore, trailingAgentYScore, trailingAgentMovementScore;
    let topScoreAgentScores, topScoreAgentScore, topScoreAgentXScore, topScoreAgentYScore, topScoreAgentMovementScore;

    // Runs once at the start of the simulation
    p.setup = function () {
        p.frameRate(60);
        p.createCanvas(canvasWidth, canvasHeight);
        setupPlanckWorldNEAT();
        lastTime = p.millis();

        for (let i = 0; i < 100; i++) {
            particles.push({
                x: Math.random() * p.width,
                y: Math.random() * p.height,
                phase: Math.random() * Math.PI * 2 // phase for sine wave
            });
        }

    };

    p.draw = function () {
        p.background(0, 0, 128);

        let currentTime = p.millis();
        let delta = currentTime - lastTime;
        lastTime = currentTime;
        leadingAgent = getLeadingAgentNEAT(p.frameCount);
        trailingAgent = getLastAgentNEAT();
        accumulator += delta;

        while (accumulator >= fixedTimeStep) {
            updatePhysics();
            accumulator -= fixedTimeStep;
        }
        if (render) {
            renderScene(p);
        } else {
            renderSkip(p);
        }
    };

    function updatePhysics() {
        if (leadingAgent) {

            // If initialization is complete, update muscles 1 agent per frame for 1 update
            if (isInitializationComplete && !simulationStarted) {
                if (areAllAgentsStableNEAT()) {
                    // Initialize updateCountStart and frameCountStart for all agents
                    for (let i = 0; i < agents.length; i++) {
                        updateCountStart[i] = 0;
                        frameCountStart[i] = 0;
                    }
                    singleUpdateCompleted = false;
                    agentIndexStart = 0;
                    simulationStarted = true;
                    currentProcess = "Letting Agents Settle";
                    console.log("Letting Agents Settle");
                }
            }

            if (simulationStarted) {
                // If not all agents have been updated x times, update one agent per frame
                if (!stabilised) {

                    if (!singleUpdateCompleted && requireStablising) {
                        // Update the agent
                        agents[agentIndexStart].updateMusclesNEAT();

                        // Initialize or increment the update count for this agent
                        frameCountStart[agentIndexStart] = (frameCountStart[agentIndexStart] || 0) + 1;

                        // If frameCount for the agent reaches framesPerUpdate, reset it and increment updateCount
                        if (frameCountStart[agentIndexStart] >= framesPerUpdateStart) {
                            frameCountStart[agentIndexStart] = 0;
                            updateCountStart[agentIndexStart] = (updateCountStart[agentIndexStart] || 0) + 1;
                        }

                        // Move to the next agent, and cycle back to the beginning if at the end of the array
                        agentIndexStart = (agentIndexStart + 1) % agents.length;
                    }

                    // Check if we've updated each agent x times
                    if (Object.values(updateCountStart).every(countStart => countStart >= updatesPerAgentStart) || !requireStablising) {
                        singleUpdateCompleted = true;
                        // All agents have been updated the required number of times, now check for stability
                        if (areAllAgentsStableNEAT() || !requireStablising) {
                            stabilised = true;
                            console.log("Agents Settled");
                            startingTickCounter = 0;
                        }
                    }
                }
                // Check if all agents are stable before proceeding with batch updates
                else {
                    // Check if it's time to update the next batch
                    if (startingTickCounter >= nextBatchFrame) {
                        // Update muscles only for the current batch of agents
                        for (let i = currentPhysicsBatch * MUSCLE_BATCH_SIZE; i < Math.min((currentPhysicsBatch + 1) * MUSCLE_BATCH_SIZE, agents.length); i++) {
                            agents[i].mainBody.setType('dynamic');
                            agents[i].updateMusclesNEAT();

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
                            nextBatchFrame = startingTickCounter + muscleUpdateFrames;
                        } else {
                            // Wait for batchDelay frames before moving to the next batch
                            nextBatchFrame = startingTickCounter + SOME_DELAY_FRAME_COUNT;
                        }
                    }
                }
                // Increment tick count each frame
                startingTickCounter++;
            }

            // Allow agents to swim and interactively control their joints
            for (let agent of agents) {
                if (simulationStarted) {

                    // Apply swimming force to agents to simulate a liquid environment
                    applySwimmingForce(agent);

                    // Apply drag to agents to simulate a liquid environment
                    applyDrag(agent);

                    // Apply joint damping to agents to prevent limbs from moving too fast or slamming into boundaries
                    applyJointDamping(agent);

                }
            }

            // Step the Planck world
            try {
                // world.step(fixedTimeStep / 1000 * physicsGranularityMultiplier, velocityIterations, positionIterations);
                world.step(1 / 60 * physicsGranularityMultiplier, velocityIterations, positionIterations);
            } catch (error) {
                console.error("An error occurred stepping physics simulation: ", error);
            }

            // If initialization is complete, increment the tick count
            if (simulationStarted && singleUpdateCompleted && stabilised) {
                tickCount++;
                if (tickCount >= simulationLengthModified) {
                    endSimulationNEAT(p);
                }
            }
        }
    }

    function renderScene(p) {

        particles.forEach((particle) => {
            particle.x += Math.sin(particle.phase) * 0.5;
            particle.y += Math.cos(particle.phase) * 0.5;
            particle.phase += 0.02;

            if (particle.x > p.width) particle.x = 0;
            if (particle.x < 0) particle.x = p.width;
            if (particle.y > p.height) particle.y = 0;
            if (particle.y < 0) particle.y = p.height;
            p.push();
            p.fill(255, 255, 255, 50);
            p.noStroke();
            p.ellipse(particle.x, particle.y, 2, 2);
            p.pop();
        });

        // To add a zoom out function, I just need to add an offset to this and the agent rendering function
        // Render walls
        p.fill(50);
        for (let wall of wallBodies) {
            const position = wall.body.getPosition();
            p.push();  // Save the current drawing settings and transformations
            p.translate(position.x + offsetX - 200, position.y + offsetY - 600);  // Translate the origin to the wall's position
            p.rotate(wall.angle);  // Rotate the coordinate system by the wall's angle
            p.rect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);  // Draw the wall
            p.pop();  // Restore the drawing settings and transformations
        }

        calculateFPS(p);
        // Render the FPS, Gen No, and Time Left
        p.fill(255);  // Black color for the text
        p.textSize(18);  // Font size
        p.text(`FPS: ${displayedFPS}`, 10, 20);
        p.text(`Batch Within Generation: ${runCount} of ${numAgentsMultiplier}`, 10, 50);
        p.text(`Generation: ${genCount}`, 10, 80);
        p.text(`Time Left: ${displayedTimeLeft.toFixed(0)} seconds`, 10, 110);
        p.text(`Top Score: ${topScoreEver.toFixed(2)}`, 10, 140);

        if (averageScore > - 10) {
            p.text(`Average Score: ${averageScore.toFixed(2)}`, 10, 170);
        } else {
            p.text(`Average Score: 0`, 10, 170);
        }

        p.text(`Distinct Population groups: ${numGroups}`, 10, 200);
        const circleDiameter = 20;
        // Render click-able circles for each group
        for (let i = 0; i < numGroups + 1; i++) {
            p.push();
            if (i == numGroups) {
                p.fill(255);
                p.ellipse(40 + i * (circleDiameter + 10), 225, circleDiameter);
            } else {
                p.fill(GROUP_COLORS[i]);
                p.ellipse(40 + i * (circleDiameter + 10), 225, circleDiameter);
            }
            p.pop();
        }
        // Check for clicks on the circles to select a color
        p.mousePressed = function () {
            for (let i = 0; i < numGroups + 1; i++) {
                let x = 40 + i * (circleDiameter + 10);
                let y = 225;
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

        p.push();
        p.fill(155);
        p.text(`Select a color above to filter that group, or white to clear`, 10, 260);
        p.text(`Agents in population: ${agentGenomePool.length}`, 10, 290);
        p.text(`Agents in simulation: ${agents.length}`, 10, 320);
        p.pop();

        if (stabilised) {
            p.push();
            p.fill(0, 255, 0);
            p.text(`Agents can go!`, 10, 380);
            p.pop();
        } else {
            p.push();
            p.fill(255, 0, 0);
            p.text(`${currentProcess}`, 10, 380);
            p.pop();
        }

        if (leadingAgent) {

            if (agentToFix == "leader") {
                offsetX = p.width / 6 - leadingAgent.position.x + leadingAgent.startingX;  // Center the leading agent on the canvas, just to the left
                offsetY = p.height * 4 / 6 - leadingAgent.position.y + leadingAgent.startingY;
                if (showRayCasts) {
                    let agentOffsetX = offsetX - leadingAgent.startingX;
                    let agentOffsetY = offsetY - leadingAgent.startingY;
                    leadingAgent.renderRayCasts(p, agentOffsetX, agentOffsetY);
                }
            } else if (agentToFix == "trailer") {
                offsetX = p.width / 6 - trailingAgent.position.x + trailingAgent.startingX;
                offsetY = p.width * 4 / 6 - trailingAgent.position.y + trailingAgent.startingY - 500;
                if (showRayCasts) {
                    let agentOffsetX = offsetX - trailingAgent.startingX;
                    let agentOffsetY = offsetY - trailingAgent.startingY;
                    trailingAgent.renderRayCasts(p, agentOffsetX, agentOffsetY);
                }
            } else if (agentToFix == "average") {

                let totalXScore = 0;

                for (let agent of agents) {
                    let eachXScore = agent.getScore(false);
                    totalXScore += parseFloat(eachXScore[1]);
                }

                let averageXScore = totalXScore / agents.length;

                offsetX = p.width / 6 - averageXScore + 100;
                // offsetY = p.width / 6 - averageXScore + 100;
            }            

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

            if (currentTime - lastUIUpdateTime > UIUpdateInterval && simulationStarted) {

                topScoreAgent = getHighestScoreNEAT();

                // Display the score of the leading agent
                leadingAgentScores = leadingAgent.getScore(false);
                leadingAgentScore = leadingAgentScores[0];
                leadingAgentXScore = leadingAgentScores[1];
                leadingAgentYScore = leadingAgentScores[2];
                leadingAgentMovementScore = leadingAgentScores[4];
                leadingAgentExplorationReward = leadingAgentScores[5];
                leadingAgentSizeReward = leadingAgentScores[6];
                leadingAgentEnergy = leadingAgentScores[7];

                // Display the score of the trailing agent
                trailingAgentScores = trailingAgent.getScore(false);
                trailingAgentScore = trailingAgentScores[0];
                trailingAgentXScore = trailingAgentScores[1];
                trailingAgentYScore = trailingAgentScores[2];
                trailingAgentMovementScore = trailingAgentScores[4];
                trailingAgentExplorationReward = trailingAgentScores[5];
                trailingAgentSizeReward = trailingAgentScores[6];
                trailingAgentEnergy = trailingAgentScores[7];

                // Display the score of the highest scoring
                topScoreAgentScores = topScoreAgent.getScore(false);
                topScoreAgentScore = topScoreAgentScores[0];
                topScoreAgentXScore = topScoreAgentScores[1];
                topScoreAgentYScore = topScoreAgentScores[2];
                topScoreAgentMovementScore = topScoreAgentScores[4];
                topScoreAgentExplorationReward = topScoreAgentScores[5];
                topScoreAgentSizeReward = topScoreAgentScores[6]; 
                topScoreAgentEnergy = topScoreAgentScores[7];

                let totalScore = 0;
                for (let agent of agents) {
                    let eachScore = agent.getScore(false);
                    totalScore += parseFloat(eachScore[0]);
                }

                averageScore = totalScore / agents.length;

                displayedTimeLeft = (simulationLengthModified - tickCount) * (1 / simulationSpeed);

                // Reset the last update time
                lastUIUpdateTime = currentTime;
            }

            p.push();
            p.fill(155);
            if (selectedColor === null) {
                p.text(`Agents on screen: ${agentsToRender.size}`, 10, 350);
            } else {
                p.text(`Agents on screen: ${agents.filter(agent => agent.genome.metadata.agentGroup == selectedColor).length}`, 10, 350);
            }
            p.pop();

            if (topScoreAgentScore > - 1000 && simulationStarted) {
                p.push();
                p.textSize(16);
                p.fill(GROUP_COLORS[topScoreAgent.genome.metadata.agentGroup]);
                p.text(`Top Scoring Agent: ${topScoreAgentScore} (X Score: ${topScoreAgentXScore} + Y Score: ${topScoreAgentYScore} + Joint Movement Bonus: ${topScoreAgentMovementScore} + Exploration Bonus: ${topScoreAgentExplorationReward} + Size Bonus: ${topScoreAgentSizeReward})  Remaining Energy: ${topScoreAgentEnergy}`, 10, groundY + 30);  // Displaying the score just below the ground

                p.fill(GROUP_COLORS[leadingAgent.genome.metadata.agentGroup]);
                p.text(`Leading Agent Score: ${leadingAgentScore} (X Score: ${leadingAgentXScore} + Y Score: ${leadingAgentYScore} + Joint Movement Bonus: ${leadingAgentMovementScore} + Exploration Bonus: ${leadingAgentExplorationReward} + Size Bonus: ${leadingAgentSizeReward}) Remaining Energy: ${leadingAgentEnergy}`, 10, groundY + 50);

                p.fill(GROUP_COLORS[trailingAgent.genome.metadata.agentGroup]);
                p.text(`Trailing Agent Score: ${trailingAgentScore} (X Score: ${trailingAgentXScore} + Y Score: ${trailingAgentYScore} + Joint Movement Bonus: ${trailingAgentMovementScore} + Exploration Bonus: ${trailingAgentExplorationReward} + Size Bonus: ${trailingAgentSizeReward}) Remaining Energy: ${trailingAgentEnergy}`, 10, groundY + 70);
                p.pop();
            }

            if (showNeuralNetwork == true && simulationStarted) {
                p.push();
                if (agentToFix == "trailer") {
                    p.text(`Showing Trailing Agents Brain`, 370, 20);
                    // Render NN for leading agent
                    p.fill(GROUP_COLORS[trailingAgent.genome.metadata.agentGroup]);
                    trailingAgent.renderNNNEAT(p, canvasWidth - 1000, (canvasHeight / 2) - 40, tickCount);
                } else {
                    p.text(`Showing Leading Agents Brain`, 370, 20);
                    // Render NN for leading agent
                    p.fill(GROUP_COLORS[leadingAgent.genome.metadata.agentGroup]);
                    leadingAgent.renderNNNEAT(p, canvasWidth - 1000, (canvasHeight / 2) - 40, tickCount);
                }
                p.pop();
            }

            if (agentsToRender.size > 1 && simulationStarted) {
                if (selectedColor === null) {
                    for (let agent of agentsToRender) {
                        if (agent) {
                            // Only render agents from agentsToRender list
                            let agentOffsetX = offsetX - agent.startingX;
                            let agentOffsetY = offsetY - agent.startingY;
                            agent.render(p, agentOffsetX, agentOffsetY);
                        }
                    }
                } else {
                    for (let agent of agents) {
                        if (agent) {
                            // Only render agents belonging to the selected color
                            if (agent.genome.metadata.agentGroup == selectedColor) {
                                let agentOffsetX = offsetX - agent.startingX;
                                let agentOffsetY = offsetY - agent.startingY;
                                agent.render(p, agentOffsetX, agentOffsetY);
                            }
                        }
                    }
                }
            }
        }

    };

    function renderSkip(p) {
        p.text(`Fast-Forwarding Generation: ${genCount}`, 10, 20);
    };
};

function areAllAgentsStableNEAT(agentsToCheck = agents) {

    // If agentsToCheck is not an array, make it an array.  Allows this function to be called with a single agent as an argument. Might use for energy recovery or similar
    if (!Array.isArray(agentsToCheck)) {
        agentsToCheck = [agentsToCheck];
    }


    // Define small thresholds for stability
    const linearStabilityThresholdBody = 0.01; 
    const angularStabilityThresholdBody = 0.15;
    const angularStabilityThresholdLimb = 0.1;
    const stabilityFrames = 50;  // Number of frames to wait before confirming stability

    let allAgentsStable = true;

    for (let agent of agentsToCheck) {
        if (agent.mainBody) {
            // Loop through limbs to check if they are stable
            for (let limb of agent.limbs) {
                if (Math.abs(limb.getAngularVelocity()) > angularStabilityThresholdLimb) {
                    allAgentsStable = false;
                    break;
                }
            }

            if (Math.abs(agent.mainBody.getAngularVelocity()) > angularStabilityThresholdBody || Math.abs(agent.mainBody.getLinearVelocity()) > linearStabilityThresholdBody) {
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

function calculateBias(agentFacingDirection, forceDirection, defaultBias) {
    // Calculate the angle difference
    let angleDifference = forceDirection - agentFacingDirection;

    // Normalize angle to range
    angleDifference = (angleDifference + Math.PI) % (2 * Math.PI) - Math.PI;

    // Determine the bias based on the angle difference
    if (Math.abs(angleDifference) < Math.PI / 2) {
        return defaultBias;
    } else if (Math.abs(angleDifference) > Math.PI / 2) {
        return 2 - defaultBias;
    } else {
        return 1;  // Use the default bias (either agent's or a fixed value)
    }
}

function applySwimmingForce(agent) {
    for (let i = 0; i < agent.joints.length; i++) {
        let angle = (i * 2 * Math.PI) / agent.numLimbs;
        let joint = agent.joints[i];
        let currentAngle = joint.getJointAngle();
        let N = 5;
        let forceScalingFactor = swimStrengthMultiplier;
        let agentFacingDirection = agent.mainBody.getAngle();
        // Add the new angle to the buffer
        agent.limbBuffer[i].push(currentAngle);

        // Check if buffer has reached N length
        if (agent.limbBuffer[i].length >= N) {

            // Calculate the average delta angle over the last N frames
            let deltaTheta = (currentAngle - agent.limbBuffer[i][0]) / N;

            // Remove the oldest angle from the buffer to maintain its size
            agent.limbBuffer[i].shift();

            // Determine the direction of the force
            let forceDirection = (currentAngle - angle) + Math.PI / 2;

            let defaultBias = (!outputsBias || !simulationStarted || !agent.biases || i >= agent.biases.length || agent.biases[i] == null)
                ? swimBiasMultiplier
                : agent.biases[i];

            let bias = calculateBias(agentFacingDirection, forceDirection, defaultBias);

            let forceMagnitude;

            forceMagnitude = deltaTheta * forceScalingFactor * bias * (2 * agent.limbMass[i] / 100) * Math.min(1, Math.max(0, (agent.agentEnergy / agent.startingEnergy)));

            if (agent.agentEnergy > 0 && agent.startingEnergy > 1) {
                agent.agentEnergy -= (Math.abs(forceMagnitude / 1000000) * energyUseForceSizeMultJS) * ((agent.limbMass[i] / 15) * energyUseLimbSizeMultJS) * ((agent.brainSize / 50) * energyUseBrainSizeMultJS);
            }


            // Calculate the force vector
            let force = planck.Vec2(Math.cos(forceDirection) * forceMagnitude, Math.sin(forceDirection) * forceMagnitude);

            // Calculate the point on the limb to apply the force
            let forceApplyPointX = agent.limbs[i].getPosition().x + Math.cos(angle) * (agent.genome.bodyPlan.limbs[i].length / 1);
            let forceApplyPointY = agent.limbs[i].getPosition().y + Math.sin(angle) * (agent.genome.bodyPlan.limbs[i].length / 1);

            let forceApplyPoint = planck.Vec2(forceApplyPointX, forceApplyPointY);

            agent.limbs[i].applyForce(force, forceApplyPoint, true);
            //// visualize this force
            //let forceStartX = forceApplyPoint.x - 200;
            //let forceStartY = forceApplyPoint.y;
            //// Scale the force for visualization. This value can be adjusted to ensure arrows are neither too long nor too short.
            //let visualizationScale = 2;
            //let forceEndX = (forceStartX - 200) + force.x * visualizationScale;
            //let forceEndY = forceStartY + force.y * visualizationScale;
            //drawArrow(p, forceStartX, forceStartY, forceEndX, forceEndY);
        }
    }
}

function applyDrag(agent) {
    dragCoefficient = liquidViscosityDecay; 

    // Apply drag to the main body's linear velocity
    let bodyVelocity = agent.mainBody.getLinearVelocity();
    agent.mainBody.setLinearVelocity(bodyVelocity.mul(dragCoefficient));

    // Apply drag to the main body's angular velocity
    let bodyAngularVelocity = agent.mainBody.getAngularVelocity();
    agent.mainBody.setAngularVelocity(bodyAngularVelocity * (dragCoefficient ** 2));

    // Apply drag to each limb
    for (let limb of agent.limbs) {
        // Linear velocity drag
        let limbVelocity = limb.getLinearVelocity();
        limb.setLinearVelocity(limbVelocity.mul(dragCoefficient));

        // Angular velocity drag
        let limbAngularVelocity = limb.getAngularVelocity();
        limb.setAngularVelocity(limbAngularVelocity * (dragCoefficient ** 2));
    }

}

function applyJointDamping(agent) {
    let maxTorqueForDamping = 10000;

    // Damping on approaching joint limits
    for (let i = 0; i < agent.joints.length; i++) {
        let currentAngle = agent.joints[i].getJointAngle();
        let angleDifferenceFromUpperLimit = agent.genome.bodyPlan.limbs[i].constraints.maxAngle - currentAngle;
        let angleDifferenceFromLowerLimit = currentAngle - agent.genome.bodyPlan.limbs[i].constraints.minAngle;

        let threshold = 0.5; // This is just an initial value, you might need to adjust it.

        if (angleDifferenceFromUpperLimit < threshold) {
            let normalizedDifferenceUpper = angleDifferenceFromUpperLimit / threshold;
            let torqueAmountUpper = maxTorqueForDamping * (1 - normalizedDifferenceUpper); // maxTorqueForDamping is a constant you'll need to set.
            agent.joints[i].getBodyB().applyTorque(torqueAmountUpper); // Assuming BodyB is the limb.
        }

        if (angleDifferenceFromLowerLimit < threshold) {
            let normalizedDifferenceLower = angleDifferenceFromLowerLimit / threshold;
            let torqueAmountLower = -maxTorqueForDamping * (1 - normalizedDifferenceLower); // Negative torque for lower limit.
            agent.joints[i].getBodyB().applyTorque(torqueAmountLower);
        }
    }
}

function initializeSketchBox2DNEAT(stageProperties) {
    canvasWidth = stageProperties.width;
    canvasHeight = stageProperties.height;
    groundY = stageProperties.groundY;
    popSize = stageProperties.numAgents;
    numAgentsMultiplier = stageProperties.totalNumAgentsMultiplier;
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
    liquidViscosityDecay = stageProperties.liquidViscosity;
    increaseTimePerGen = stageProperties.timeIncrease;
    mapNo = stageProperties.map;
    randomMapSelector = stageProperties.randomMap;
    maxSimulationLengthCount = stageProperties.simulationLengthIncrease;
    simulationLengthIncreaseCount = stageProperties.maxSimulationLength;
    requireStablising = stageProperties.agentsRequireStablising;


    simulationLengthModified = simulationLength;
    frameCountSinceLastFPS = 0;
    lastFPSCalculationTime = 0;
    tickCount = 0;
    displayedTimeLeft = 0;
    MAX_ADJUSTMENT_TORQUE = 500000;
    offsetY = 0;
    showRayCasts = true;
    singleUpdateCompleted = false;
    updatesPerAgentStart = 1;
    framesPerUpdateStart = 10;
    updateCountStart = {};
    frameCountStart = {};
    agentIndexStart = 0;
    leadingAgents = [];
    randomlySelectedAgents = [];
    currentAgentIndex = 0;
    offsetX = 0;
    displayedFPS = 0;
    lastUIUpdateTime = 0;
    topScoreEver = 0;
    stabilityCounter = 0;
    selectedColor = null;

    currentProcess = "Initializing world!";

    // If there are existing agents with models, dispose of them
    for (let agent of agents) {
        if (agent.brain) {
            agent.brain.dispose();
        }
    }

    // If there are existing walls, destroy them
    if (wallBodies) {
        for (let wall of wallBodies) {
            world.destroyBody(wall.body);
        }
        wallBodies = [];
    }

    if (duplicateWalls) {
        for (let wall of duplicateWalls) {
            world.destroyBody(wall.body);
        }
        duplicateWalls = [];
    }

    // If there's an existing p5 instance, remove it
    if (p5Instance) {
        p5Instance.remove();
        p5Instance = null;
    }
    // Create a new p5 instance and assign it to the global reference
    p5Instance = new p5(sketchNEAT, 'canvas-container-NEAT');
}

function toggleRayCastRender(showRays) {
    showRayCasts = showRays;
    console.log("toggling RayCasts render");
}

function logGenomes() {
    // Function to log the genomes of all agents
    agents.sort((a, b) => parseFloat(b.getScore(false)[0]) - parseFloat(a.getScore(false)[0]))[0];
    let tempAgentsInGen = [];
    agents.forEach(agent => {
        tempAgentsInGen.push(agent);
    });
    console.log("Current agents Array Sorted by Score: ", tempAgentsInGen);

    tempAgentPool.sort((a, b) => parseFloat(b.getScore(false)[0]) - parseFloat(a.getScore(false)[0]))[0];
    let tempAgents = [];
    tempAgentPool.forEach(agent => {
        tempAgents.push(agent);
    });
    console.log("tempAgentPool Array Sorted by Score: ", tempAgents);

    let newGenomes = [];
    tempAgentGenomePool.forEach(agent => {
        newGenomes.push(agent);
    });
    console.log("tempAgentGenomePool: ", newGenomes);

    let genomes = [];
    agentGenomePool.forEach(agent => {
        genomes.push(agent);
    });
    console.log("agentGenomePool: ", genomes);
}

function retrieveGenomes() {
    return JSON.stringify(agentGenomePool);
}

function skipGen(skipNo) {
    // Function to skip a number of generations by disabling the rendering flag and speeding up physics ticks.  Make use of the 'render' flag, the genCount, which increments automatically every generation, and the simulationSpeed which can be set to 480.  Make use of recursive function to check if genCount has increased by skipNo since the function was called.  We do not need to increment genCount, it already counts generations as they pass
    if (skipNo > 0) {
        simulationSpeed = 480;
        fixedTimeStep = (1.0 / simulationSpeed) * 1000;
        render = false;
        let currentGen = genCount;
        let skipGenRecursive = function () {
            if (genCount < currentGen + skipNo) {
                setTimeout(skipGenRecursive, 100);
            } else {
                simulationSpeed = 60;
                fixedTimeStep = (1.0 / simulationSpeed) * 1000;
                render = true;
            }
        };
        skipGenRecursive();
    }
}

function updateSimulationNEAT(stageProperties) {
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

function initializeAgentsBox2DNEAT(agentProperties, totalPopulationGenomes) {
    // limbsPerAgent = agentProperties.numLimbs; // To be replaced
    // torque = agentProperties.musculeTorque; // To be replaced
    MAX_ADJUSTMENT = agentProperties.maxJointSpeed;  // To be replaced
    // jointMaxMove = agentProperties.maxJointMoveDivider;  // To be replaced
    brainDecay = agentProperties.brainDecayOverTime;
    inputsJointAngle = agentProperties.inputJointAngle;  // To be replaced
    inputsJointSpeed = agentProperties.inputJointSpeed;  // To be replaced
    inputsAgentPos = agentProperties.inputAgentPos;  // To be replaced
    inputsAgentV = agentProperties.inputAgentV;  // To be replaced
    inputsScore = agentProperties.inputScore;  // To be replaced
    inputsOrientation = agentProperties.inputOrientation;  // To be replaced
    inputsTimeRemaining = agentProperties.inputTimeRemaining;  // To be replaced
    inputsGroundSensors = agentProperties.inputGroundSensors;  // To be replaced
    inputsDistanceSensors = agentProperties.inputDistanceSensors;  // To be replaced
    // agentMutationRate = agentProperties.offspringMutationRate; 
    outputJointSpeed = agentProperties.outputsJointSpeed;
    outputJointTorque = agentProperties.outputsJointTorque;
    outputBias = agentProperties.outputsBias;
    swimStrengthMultiplier = agentProperties.swimStrength;
    swimBiasMultiplier = agentProperties.swimBias; 
    xScoreMult = agentProperties.xScoreMultiplier;
    yScoreMult = agentProperties.yScoreMultiplier;
    movementScoreMult = agentProperties.movementScoreMultiplier;
    explorationScoreMult = agentProperties.explorationScoreMultiplier;
    sizeScoreMult = agentProperties.sizeScoreMultiplier;
    startingEnergyBaseJS = agentProperties.startingEnergyBase;
    startingEnergyMassPowerJS = agentProperties.startingEnergyMassPower;
    startingEnergyBodyMassMultJS = agentProperties.startingEnergyBodyMassMult;
    startingEnergyLimbMassMultJS = agentProperties.startingEnergyLimbMassMult;
    energyUseForceSizeMultJS = agentProperties.energyUseForceSizeMult;
    energyUseLimbSizeMultJS = agentProperties.energyUseLimbSizeMult;
    energyUseBrainSizeMultJS = agentProperties.energyUseBrainSizeMult;


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

    agentGenomePool = _.cloneDeep(totalPopulationGenomes);

    agents = [];  // Reset the agents array
    currentProcess = "Initializing first generation!";

    // let populationGenomes equal a selection of totalPopulationGenomes based on the totalPopulationGenomes[i].metadata.runGroup.  Just runGroup 0 here
    let populationGenomes = totalPopulationGenomes.filter(genome => genome.metadata.runGroup === 0);

    // Initialize agents in batches
    if (Array.isArray(populationGenomes) && populationGenomes.length === popSize) {
        for (let i = 0; i < popSize; i += BATCH_SIZE) {
            initializeAgentBatchNEAT(i, Math.min(i + BATCH_SIZE, popSize), populationGenomes);
        }
    } else {
        console.log("Issue with population genomes");
    }

    waitForFirstInitializationCompletionNEAT(populationGenomes, totalPopulationGenomes);

    displayedTimeLeft = (simulationLength - tickCount) * (1 / simulationSpeed);
}

// Function to initialize a batch of agents
function initializeAgentBatchNEAT(startIndex, endIndex, populationGenomes) {
    for (let i = startIndex; i < endIndex; i++) {
        initializeAgentNEAT(i, populationGenomes[i]);
    }
}

// Function to initialize a single agent
function initializeAgentNEAT(i, genome) {
    setTimeout(() => {
        // Using genome properties to initialize the agent
        let agent = new AgentNEAT(genome, i, false);

        let randomAngle = -Math.random() * Math.PI / 2;
        agent.mainBody.setAngle(randomAngle);
        agent.genome.metadata.groupName = GROUP_COLORS_NAMES[agent.genome.metadata.agentGroup];
        agents.push(agent);

        if (agents.length >= popSize ) {
            isInitializationComplete = true;
        }
    }, i * delay);
}

function waitForFirstInitializationCompletionNEAT(populationGenomes, totalPopulationGenomes) {
    // Check if agents initialized
    if (isInitializationComplete) {

        runCount++;
        currentProcess = "Starting first round of simulation!";
        // set numGroups to the largest value in agentGenomePool.metadata.AgentGroup
        numGroups = Math.max(...agentGenomePool.map(genome => genome.metadata.agentGroup)) + 1;

        // Randomly select agents to render for each group
        randomlySelectedAgents = [];
        for (let groupId = 0; groupId < numGroups; groupId++) {
            let groupAgents = agents.filter(agent => agent.genome.metadata.agentGroup === groupId);

            // Select few random agents
            for (let i = 0; i < renderedAgents; i++) {
                let randomIndex = Math.floor(Math.random() * groupAgents.length);
                randomlySelectedAgents.push(groupAgents[randomIndex]);
            }
        }

        // Manual nullification of these arrays is almost certainly not necessary, but I'm doing it anyway
        populationGenomes = null;
        totalPopulationGenomes = null;
        let tempPopulationGenomes = [];
        agents.forEach(agent => {
            // add agent's genome to the genomes array
            tempPopulationGenomes.push(agent.genome);
        });

        offsetX = 0;

    } else {
        // If the agents not initialized, wait for some time and check again
        setTimeout(waitForFirstInitializationCompletionNEAT, 100); // Checking every 100ms
    }
}

function logModelWeights(agent) {

    // Filtering tensors to get only weights (even indices)
    let allWeightTensors = agent.brain.getWeights().filter((_, idx) => idx % 2 === 0);
    // Flat mapping tensors to extract weight values
    let allWeights = allWeightTensors.flatMap(tensor => Array.from(tensor.dataSync()));

    // Filtering tensors to get only biases (odd indices)
    let allBiasesTensors = agent.brain.getWeights().filter((_, idx) => idx % 2 === 1);
    // Flat mapping tensors to extract bias values
    let allBiases = allBiasesTensors.flatMap(tensor => Array.from(tensor.dataSync()));

    // Logging the weights and biases
    console.log("Weights: ", allWeights);
    console.log("Biases: ", allBiases);

}

//this agent will do for now, but I intend to replace with with a dynamic body plan that can 'evolve' over time.
//I think a JSON file defining a series of body and limb shapes, possibly with limbs connected to limbs etc
//Starting from a random config, this would not work, as there would be little chance of initial fitness, but starting from a simple body plan and evolving complexity based on randomness and fitness might work.
function AgentNEAT(agentGenome, agentNo, mutatedBrain, existingBrain = null) {

    // Should clean up the order of initialization of these variables and group functions together
    this.genome = _.cloneDeep(agentGenome); // Deep copy of genome
    agentGenome = null;
    this.numLimbs = this.genome.bodyPlan.limbs.length;
    this.numSegments = this.genome.bodyPlan.bodySegments.length + 1; // +1 for the main body
    this.index = this.genome.metadata.agentIndex;
    let mainBodyRadius = this.genome.bodyPlan.mainBody.size;
    // const locationBatchSize = 10;
    this.startingX = 200 + (Math.floor(this.genome.metadata.runGroup) * 5000);
    this.startingY = 600;
    this.limbBuffer = Array(this.numLimbs).fill().map(() => []);
    let mainBodyDensity = this.genome.bodyPlan.mainBody.density;
    this.mainBody = createMainBodyNEAT(world, this.startingX, this.startingY, mainBodyRadius, mainBodyDensity);
    this.position = this.mainBody.getPosition();
    this.rayCastPoints = [];

    this.Score = 0;
    this.internalMap = [];
    this.coveredCellCount = 0;

    if (explorationScoreMult > 0) {
        for (let i = 0; i < 500; i++) {
            let row = [];
            for (let n = 0; n < 500; n++) {
                row.push(false);
            }
            this.internalMap.push(row);
        }
    }

    this.limbs = [];
    this.limbMass = [];
    this.joints = [];
    this.biases = [];

    for (let i = 0; i < this.numLimbs; i++) {
        this.biases.push(1.5);
    }

    // Brain size is used to calculate how much energy the agent uses for movement, bigger brains use more energy.  Could include weight sum too
    this.brainSize = this.genome.inputLayerGenes[0].numberOfNeurons + this.genome.outputLayerGenes[0].numberOfNeurons;
    for (let i = 0; i < this.genome.layerGenes.length; i++) {
        this.brainSize += this.genome.layerGenes[i].numberOfNeurons;
    }

    for (let i = 0; i < this.numLimbs; i++) {

        const angle = this.genome.bodyPlan.limbs[i].startingAngle;

        let limbX = this.startingX + this.genome.bodyPlan.limbs[i].attachment.x;
        let limbY = this.startingY + this.genome.bodyPlan.limbs[i].attachment.y;

        let limb = createLimbNEAT(world, limbX, limbY, this.genome.bodyPlan.limbs[i].length, this.genome.bodyPlan.limbs[i].width, angle - Math.PI / 2, agentNo, i);
        this.limbs.push(limb);
        this.limbMass.push(limb.getMass());

        let localAnchorA = planck.Vec2(
            this.genome.bodyPlan.limbs[i].attachment.x,
            this.genome.bodyPlan.limbs[i].attachment.y
        );

        // Calculate the point after rotation
        let localAnchorB = planck.Vec2(0, -this.genome.bodyPlan.limbs[i].length / 2);

        let joint = createRevoluteJointNEAT(world, this.mainBody, limb, localAnchorA, localAnchorB, this.genome.bodyPlan.limbs[i].constraints.minAngle, this.genome.bodyPlan.limbs[i].constraints.maxAngle, this.genome.bodyPlan.limbs[i].constraints.maxTorque);
        this.joints.push(joint);
    }

    // Use the genome to give the agent a brain!
    if (existingBrain) {
        this.brain = existingBrain;
    } else if (mutatedBrain) {
        // dispose of old brain
        if (this.brain) {
            this.brain.dispose();
        }
        this.brain = constructModelFromGenome(this.genome);
    }  else {
        this.brain = createNeuralNetworkNEAT(this.genome);
    }

    // Score and energy stuff
    this.limbMassTot = 0;

    if (this.limbMassTot < 10) {
        for (let i = 0; i < this.limbs.length; i++) {
            this.limbMassTot += this.limbs[i].getMass();
        }
    }

    if (startingEnergyBodyMassMultJS > 0) {
        this.startingEnergy = startingEnergyBaseJS + (((this.mainBody.getMass() / 20000 * startingEnergyBodyMassMultJS) + (this.limbMassTot / 100) * startingEnergyLimbMassMultJS) * (simulationLength / 1000)) ** startingEnergyMassPowerJS; // + body segments mass and maybe limbs later
        this.agentEnergy = this.startingEnergy;
    } else {
        this.startingEnergy = 1;
        this.agentEnergy = this.startingEnergy;
    }

    this.weightPenaltyCache = null;
    this.weightPenaltyCounter = 0;

    this.getWeightPenalty = function () {
        this.weightPenaltyCounter++;
        // Called only at end of round as expensive
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

            // Now that I randomly change the agent's starting angles, we need to only increment score after round starts
            if (stabilised) {
                let change = Math.abs(currentAngle - this.previousJointAngles[i]) * (this.limbs[i].getMass() / 100);
                totalChange += change;
            }

            // Update the previous angle for next time
            this.previousJointAngles[i] = currentAngle;
        }

        // Exponential decay for the reward. You can adjust the decay factor as needed.
        let decayFactor = 0.90;

        // Calculate the current reward, decaying it based on the total rewards given so far.
        // Dividing totalJointMovementReward by totalChange ensures the decayFactor is applied over time.
        let currentReward = totalChange * Math.pow(decayFactor, this.totalJointMovementReward);

        // If totalChange is 0, handle it to avoid division by zero
        if (totalChange === 0) {
            currentReward = 0;
        }

        // Accumulate joint movement reward
        this.totalJointMovementReward += currentReward;

        return this.totalJointMovementReward;
    };

    this.getExplorationReward = function () {

        // Calculate the position relative to the map's origin (considering the granularity)
        let gridX = Math.floor((this.position.x - this.startingX) + 10 / 50) + 5;  // Start in cell 5,5 slightly offset from the origin so they can explore backwards.  The +10 is to account for the agent spawning on the boundary of a grid, so getting 4 cells explored instantly
        let gridY = Math.floor((this.startingY - this.position.y) + 10 / 50) + 5;  // Subtracting due to flipped Y-axis

        if (gridX >= 0 && gridX < 500 && gridY >= 0 && gridY < 500) {
            if (!this.internalMap[gridY][gridX]) { // If the cell hasn't been visited yet
                this.internalMap[gridY][gridX] = true;  // Mark the cell as visited
                this.coveredCellCount++;  // Increment the covered cell count
            }
        }

        return this.coveredCellCount;
    };

    this.furthestXPos = this.startingX;
    this.furthestYPos = this.startingY;
    this.massBonus = 0;
    this.getScore = function (roundOver) {

        if (this.position.x > this.furthestXPos) {
            this.furthestXPos = this.position.x;
        }
        if (this.position.y < this.furthestYPos) {  // Assuming north is negative Y
            this.furthestYPos = this.position.y;
        }

        // If the agent has made new progress in the x or y direction, update the furthest position.
        let XPosScore = Math.floor(this.furthestXPos - this.startingX) * xScoreMult;
        let YPosScore = Math.floor(this.startingY - this.furthestYPos) * yScoreMult;

        let jointMovementReward = 0;
        if (movementScoreMult > 0) {
            jointMovementReward = (this.getJointMovementReward() * 15 / this.numLimbs) * movementScoreMult; // Adjust multiplier if needed
        }

        let explorationReward = 0;

        if (explorationScoreMult > 0) {
            explorationReward = this.getExplorationReward() * explorationScoreMult;
        }

        let weightPenalty;
        //if (roundOver) {
        //    weightPenalty = this.getWeightPenalty() * 50;
        //} else {
            weightPenalty = 0;
        //}

        if (!roundOver && this.massBonus < 10 && sizeScoreMult > 0) {
            try {
                this.massBonus = this.mainBody.getMass() * sizeScoreMult;
                // loop through limbs and add their mass to the massBonus
                for (let i = 0; i < this.limbs.length; i++) {
                    this.massBonus += this.limbs[i].getMass() * (sizeScoreMult / 3);
                }
            } catch (e) {
                this.massBonus = 0;
            }
        }

        this.Score = XPosScore + YPosScore + jointMovementReward + explorationReward - weightPenalty + this.massBonus;

        if (this.Score < 1) {
            this.Score = 1;
        }

        if (this.Score > topScoreEver) {
            topScoreEver = this.Score;
        }

        return [
            parseFloat(this.Score.toFixed(2)),
            parseFloat(XPosScore.toFixed(2)),
            parseFloat(YPosScore.toFixed(2)),
            parseFloat(weightPenalty.toFixed(2)),
            parseFloat(jointMovementReward.toFixed(2)),
            parseFloat(explorationReward.toFixed(2)),
            parseFloat(this.massBonus.toFixed(2)),
            parseFloat(this.agentEnergy.toFixed(2))
        ];

    };

    this.render = function (p, offsetX, offsetY) {
        // Set the fill color based on group
        p.fill(GROUP_COLORS[this.genome.metadata.agentGroup]);
        p.stroke(0);
        // Render the main body
        if (this.mainBody) {
            let mainPos = this.position;
            let mainAngle = this.mainBody.getAngle();
            let arrowLength = mainBodyRadius / 2; // Or any length you prefer
            let arrowBase = mainBodyRadius / 4;   // The size of the base of the arrow triangle

            p.push();
            p.translate(mainPos.x + offsetX, mainPos.y + offsetY);  // Added offsetX
            p.rotate(mainAngle);

            // Draw the main body
            p.ellipse(0, 0, mainBodyRadius * 2, mainBodyRadius * 2);

            p.fill(0);
            // Draw arrow stem pointing right (East)
            p.strokeWeight(2); // Adjust thickness of the arrow as needed
            p.line(0, 0, arrowLength, 0);

            // Draw the arrowhead
            p.triangle(arrowLength, 0,
                arrowLength - arrowBase, arrowBase / 2,
                arrowLength - arrowBase, -arrowBase / 2);

            p.pop();
            p.fill(GROUP_COLORS[this.genome.metadata.agentGroup]);
        }
        //p.fill(0);
        //p.fill(GROUP_COLORS[this.genome.metadata.agentGroup]);

        // Render the limbs
        for (let i = 0; i < this.numLimbs; i++) {
            let limb = this.limbs[i];
            if (limb) {
                let limbPos = limb.getPosition();
                let limbAngle = limb.getAngle();
                let genomeLimb = this.genome.bodyPlan.limbs[i];
                p.push();
                p.translate(limbPos.x + offsetX, limbPos.y + offsetY);
                p.rotate(limbAngle);
                p.rect(-genomeLimb.width / 2, -genomeLimb.length / 2, genomeLimb.width, genomeLimb.length); // Using width and length from genome
                p.pop();
            }
        }

        // Render the joints
        for (let i = 0; i < this.numLimbs; i++) {
            if (this.joints[i]) {
                let jointPos = this.joints[i].getAnchorA();
                p.push();
                // Check if the current joint's index is within the jointColors array length
                if (i < JOINT_COLORS.length) {
                    p.fill(JOINT_COLORS[i]);  // Set the fill color to the corresponding color from the jointColors array
                } else {
                    p.fill(0, 255, 0);  // Default fill color if there isn't a corresponding color in the array
                }
                p.ellipse(jointPos.x + offsetX, jointPos.y + offsetY, 7, 7);  // Added offsetX
                p.pop();
            }
        }

        // Render second set of joint anchors for testing
        //for (let i = 0; i < this.numLimbs; i++) {
        //    if (this.joints[i]) {
        //        p.push();
        //        let jointPos = this.joints[i].getAnchorB();
        //        // Check if the current joint's index is within the jointColors array length
        //        if (i < JOINT_COLORS.length) {
        //            p.fill(0, 255, 0);  // Set the fill color to the corresponding color from the jointColors array
        //        } else {
        //            p.fill(0, 255, 0);  // Default fill color if there isn't a corresponding color in the array
        //        }
        //        p.ellipse(jointPos.x + offsetX, jointPos.y + offsetY, 3, 3);  // Added offsetX
        //        p.pop();
        //    }
        //}
    };

    this.renderRayCasts = function (p, offsetX, offsetY) {
        p.push()
        p.stroke(255, 0, 0);  // Set the color of the rays (red in this case)

        for (let ray of this.rayCastPoints) {
            let startX = ray.start.x + offsetX;
            let startY = ray.start.y + offsetY;
            let endX = ray.end.x + offsetX;
            let endY = ray.end.y + offsetY;

            p.line(startX, startY, endX, endY);
        }

        p.pop();
    };

}

function createMainBodyNEAT(world, x, y, radius, mainBodyDensity) {
    let bodyDef = {
        type: 'static',
        position: planck.Vec2(x, y)
    };

    let body = world.createBody(bodyDef);
    let shape = planck.Circle(radius);
    let fixtureDef = {
        shape: shape,
        density: mainBodyDensity,
        filterCategoryBits: CATEGORY_AGENT_BODY,
        filterMaskBits: CATEGORY_GROUND  // Only allow collision with the ground
    };
    body.createFixture(fixtureDef);
    // body.setUserData("Agent " + agentNo + " Main Body");
    return body;
}

function createLimbNEAT(world, x, y, length, width, angle, agentNo, limbNo) {
    let bodyDef = {
        type: 'dynamic',
        position: planck.Vec2(x, y),
        angle: angle
    };

    let body = world.createBody(bodyDef);
    let shape = planck.Box(width / 2, length / 2);

    // Assign a negative group index based on the agent number
    // This ensures that limbs of the same agent will never collide with each other
    // let groupIndex = -agentNo;

    let fixtureDef = {
        shape: shape,
        density: 0.1,
        filterCategoryBits: CATEGORY_AGENT_LIMB,
        filterMaskBits: CATEGORY_GROUND,  // Only allow collision with the ground
        // filterGroupIndex: groupIndex      // Set the group index
    };
    body.createFixture(fixtureDef);
    // body.setUserData("Agent " + agentNo + " Limb " + limbNo);

    return body;
}

function createRevoluteJointNEAT(world, bodyA, bodyB, localAnchorA, localAnchorB, lowerAngle, upperAngle, limbTorque) {

    let jointDef = {
        bodyA: bodyA,
        bodyB: bodyB,
        localAnchorA: localAnchorA,
        localAnchorB: localAnchorB,
        lowerAngle: lowerAngle,
        upperAngle: upperAngle,
        enableLimit: true,
        motorSpeed: 0.0,
        maxMotorTorque: limbTorque,
        enableMotor: true
    };

    return world.createJoint(planck.RevoluteJoint(jointDef, bodyA, bodyB));
}


function getLeadingAgentNEAT(frameCounter) {

    if (agents.length === 0) return null;

    if (frameCounter % 30 === 0) {
        // Truncate randomlySelectedAgents to keep initialized picks
        randomlySelectedAgents = randomlySelectedAgents.slice(0, numGroups * renderedAgents);

        // Create an array of the leading agents from each group
        let leadingAgents = [];
        for (let groupId = 0; groupId < numGroups; groupId++) {
            let groupAgents = agents.filter(agent => agent.genome.metadata.agentGroup === groupId);

            // Select leading agent
            let leadingAgent = groupAgents.sort((a, b) => parseFloat(b.getScore(false)[0]) - parseFloat(a.getScore(false)[0]))[0];

            leadingAgents.push(leadingAgent);
        }

        randomlySelectedAgents.push(...leadingAgents);

        // Update the cached leading agent
        cachedLeadingAgent = agents.reduce((leading, agent) =>
            (((agent.position.x - agent.startingX) + (1 - agent.position.y - agent.startingY)) > ((leading.position.x - leading.startingX) + (1 - leading.position.y - leading.startingY)) ? agent : leading),
            agents[0]
        );
    }

    return cachedLeadingAgent;
}

function getLastAgentNEAT() {
    if (agents.length === 0) return null;

    return agents.reduce((trailing, agent) =>
        (((agent.position.x - agent.startingX) + (1 - agent.position.y - agent.startingY)) < ((trailing.position.x - trailing.startingX) + (1 - trailing.position.y - trailing.startingY)) ? agent : trailing),
        agents[0]
    );
}


function getHighestScoreNEAT() {
    if (agents.length === 0) return null;

    agents.sort((a, b) => parseFloat(b.getScore(false)[0]) - parseFloat(a.getScore(false)[0]));

    return agents[0];
}

function endSimulationNEAT(p) {
    // p.noLoop();
    stabilised = false;
    singleUpdateCompleted = false;
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

    //for (let wall of wallBodies) {
    //    world.destroyBody(wall.body);
    //}
    //wallBodies = []; 

    //for (let wall of duplicateWalls) {
    //    world.destroyBody(wall.body);
    //}
    //duplicateWalls = [];

    // loop through all agents scores and log them
    for (let i = 0; i < agents.length; i++) {
        let thisScore = agents[i].getScore(false)[0];

        agents[i].genome.agentHistory.lastScore = { score: thisScore, map: randMap, generation: genCount };

        // Store the score only if the generation is a multiple of STORE_EVERY_N_GENERATIONS
        if (genCount % 5 === 0) {
            agents[i].genome.agentHistory.scoreHistory.push({ score: thisScore, map: randMap, generation: genCount });
        }

        agents[i].genome.agentHistory.rankInPop = (i + 1);

        if (thisScore > agents[i].genome.metadata.bestScore) {
            agents[i].genome.metadata.bestScore = thisScore;
        }
    }

    // loop through agents array with a for each and add each agent to tempAgentPool
    agents.forEach(agent => tempAgentPool.push(_.cloneDeep(agent)));

    // Continue to the next generation once the tempAgentPool is full
    if (tempAgentPool.length >= popSize * numAgentsMultiplier) {
        nextGenerationNEAT(p);
    } else {
        nextAgentgroupNEAT(p);
    }

}

function setupPlanckWorldNEAT() {
    // Create the Planck.js world
    // Could use the gravity property to add a 'current' to the world, rather than creating it with forces manually.  I assume this property is fixed once the world is created though
    const gravity = planck.Vec2(0.0, GravityStrength * 9.8);
    world = planck.World(planck.Vec2(0.0, 0.0));

    // Adds event listener for collisions, console logged. Will need to uncomment UserData setting for each body to use
    //world.on('begin-contact', function (contact) {
    //    let fixtureA = contact.getFixtureA();
    //    let fixtureB = contact.getFixtureB();
    //    let bodyA = fixtureA.getBody();
    //    let bodyB = fixtureB.getBody();

    //    console.log("Collision between:", bodyA.getUserData(), "and", bodyB.getUserData());
    //});

    createMaps(mapNo);
}

function createMaps(mapNumber) {

    // If there are existing walls, destroy them
    if (wallBodies) {
        for (let wall of wallBodies) {
            world.destroyBody(wall.body);
        }
        wallBodies = [];
    }

    if (duplicateWalls) {
        for (let wall of duplicateWalls) {
            world.destroyBody(wall.body);
        }
        duplicateWalls = [];
    }

    let startX = 200;
    let startY = 600;

    while (mapNumber == 0 || mapNumber == 3) {
        mapNumber = Math.floor(Math.random() * 5);
    }

    if (mapNumber == 0) {
        // Map starts agents in a channel with obstacles to get around, then opens up to free space
        let channelWidth = 200;
        let channelLength = 800;

        // Create the two long walls along the path
        createWall(startX + 150, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100, 10, channelLength, Math.PI / 4); // Right wall

        // Create the short wall at the bottom of the path
        createWall(startX - 50, startY + 100, 10, channelWidth, -Math.PI / 4); // Bottom wall

        // Obstacles
        createWall(startX + 50, startY - 80, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 130 + channelWidth, startY - channelWidth, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 460, startY - 490, 10, channelWidth / 2, -Math.PI / 4);

    } else if (mapNumber == 1) {
        // Map starts agents in free space and forces them to find the channel and complete it to move further
        let channelWidth = 200;
        let channelLength = 800;

        startX += 400;
        startY -= 400;

        // Create the two long walls along the path
        createWall(startX + 150, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100, 10, channelLength, Math.PI / 4); // Right wall

        // Create the boundary walls to force agents through channel
        createWall(startX - 480, startY - 330, 10, 1000, -Math.PI / 4);
        createWall(startX + 380, startY + 530, 10, 1000, -Math.PI / 4);
        createWall(startX + 150 - 1000, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100 + 1000, 10, channelLength, Math.PI / 4); // Right wall

        // Obstacles
        createWall(startX + 50, startY - 80, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 130 + channelWidth, startY - channelWidth, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 460, startY - 490, 10, channelWidth / 2, -Math.PI / 4);

    } else if (mapNumber == 2) {
        // Map is a grid of lines to avoid
        let channelWidth = 200;

        startX -= 150;
        startY += 150;

        const repeatCount = 3; // Repeats in each direction
        const gridSpacing = 350; // Spacing between each repeat

        createWall(startX, startY - 700, 10, 1400);
        createWall(startX + 700, startY, 10, 1400, -Math.PI / 2);
        createWall(startX + 1400, startY - 600, 10, 1200);
        createWall(startX + 600, startY - 1400, 10, 1200, -Math.PI / 2);

        // Loop through rows and columns
        for (let row = 0; row < repeatCount; row++) {
            for (let col = 0; col < repeatCount; col++) {
                let gridOffsetX = col * gridSpacing;
                let gridOffsetY = row * -gridSpacing;

                // Create the lines with the offsets added to the original positions
                createWall(startX + 250 + gridOffsetX, startY - 240 + gridOffsetY, 10, channelWidth / 2, -Math.PI / 4);
                createWall(startX + 410 + gridOffsetX, startY - 400 + gridOffsetY, 10, channelWidth / 2, -Math.PI / 4);
            }
        }

    } else if (mapNumber == 3) {
        // Map starts agents in a channel with obstacles to get around, then opens up to free space
        let channelWidth = 200;
        let channelLength = 800;

        startY -= 50;
        startX -= 50;

        // Create the two long walls along the path
        createWall(startX + 150, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100, 10, channelLength, Math.PI / 4); // Right wall

        // Create the short wall at the bottom of the path
        createWall(startX - 50, startY + 100, 10, channelWidth, -Math.PI / 4); // Bottom wall

        // Obstacles
        createWall(startX + 50 + 75, startY - 80 + 75, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 130 + 75, startY - channelWidth - 50, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 460 + 75, startY - 490 + 75, 10, channelWidth / 2, -Math.PI / 4);

    } else if (mapNumber == 4) {
        // Map starts agents in free space and forces them to find the channel and complete it to move further
        let channelWidth = 200;
        let channelLength = 800;

        startX += 400;
        startY -= 400;

        // Create the two long walls along the path
        createWall(startX + 150, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100, 10, channelLength, Math.PI / 4); // Right wall

        // Create the boundary walls to force agents through channel
        createWall(startX - 480, startY - 330, 10, 1000, -Math.PI / 4);
        createWall(startX + 380, startY + 530, 10, 1000, -Math.PI / 4);
        createWall(startX + 150 - 1000, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100 + 1000, 10, channelLength, Math.PI / 4); // Right wall

        // Obstacles
        createWall(startX + 50 + 75, startY - 80 + 75, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 130 + 75, startY - channelWidth - 50, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 460 + 75, startY - 490 + 75, 10, channelWidth / 2, -Math.PI / 4);

    }
}

function createWall(x, y, width, height, angle = 0) {

    for (let i = 0; i < Math.ceil(numAgentsMultiplier); i++) {
        const offset = i * 5000; // Define an appropriate spacing value to separate the sets of walls
        const wallDef = {
            type: 'static',
            position: planck.Vec2(x + offset, y),
            angle: angle
        };
        const wallBody = world.createBody(wallDef);
        const wallShape = planck.Box(width / 2, height / 2);
        const fixtureDef = {
            shape: wallShape,
            filterCategoryBits: CATEGORY_GROUND,
            filterMaskBits: CATEGORY_AGENT_BODY | CATEGORY_AGENT_LIMB
        };
        wallBody.createFixture(fixtureDef);

        if (i === 0) {
            // Only add the original set of walls to the wallBodies array for rendering
            wallBodies.push({
                body: wallBody,
                width: width,
                height: height,
                angle: angle
            });
        } else {
            // Add duplicate walls to the duplicateWalls array
            duplicateWalls.push({
                body: wallBody,
                width: width,
                height: height,
                angle: angle
            });
        }
    }
}


/*            Neural Network Functions                     */

function createNeuralNetworkNEAT(genome) {
    const model = tf.sequential();
    let biasID = 0;  // Initialize a counter for bias IDs

    // Input layer
    tf.tidy(() => {
        const inputLayer = tf.layers.dense({
            units: genome.inputLayerGenes[0].numberOfNeurons,
            activation: activationTypeToString(genome.inputLayerGenes[0].activationType),
            inputShape: [genome.inputLayerGenes[0].inputs.length],
            biasInitializer: 'heNormal',
            kernelInitializer: 'heNormal'
        });
        model.add(inputLayer);
        let weightsBiases = inputLayer.getWeights();
        genome.inputLayerGenes[0].biases = weightsBiases[1].arraySync().map(b => ({ id: biasID++, value: b }));
        // weightsBiases.forEach(tensor => tensor.dispose());
    });

    // Save the IDs of biases from the input layer to assign them as fromNodeID for the first hidden layer
    const previousLayerBiasIDs = genome.inputLayerGenes[0].biases.map(b => b.id);

    // Hidden layers
    for (let i = 0; i < genome.layerGenes.length; i++) {
        tf.tidy(() => {

            const layer = tf.layers.dense({
                units: genome.layerGenes[i].numberOfNeurons,
                activation: activationTypeToString(genome.layerGenes[i].activationType),
                biasInitializer: 'heNormal',
                kernelInitializer: 'heNormal'
            });
            model.add(layer);
            let weightsBiases = layer.getWeights();

            genome.layerGenes[i].biases = weightsBiases[1].arraySync().map(b => ({ id: biasID++, value: b }));

            genome.layerGenes[i].weights = weightsBiases[0].arraySync().map((wRow, rowIndex) =>
                wRow.map((w, colIndex) => ({
                    fromNodeID: previousLayerBiasIDs[rowIndex],
                    toNodeID: genome.layerGenes[i].biases[colIndex].id,
                    value: w
                }))
            );

            // weightsBiases.forEach(tensor => tensor.dispose());

            // Save the IDs of biases from the current hidden layer to assign them as fromNodeID for the next layer
            const currentLayerBiasIDs = genome.layerGenes[i].biases.map(b => b.id);
            previousLayerBiasIDs.length = 0;
            Array.prototype.push.apply(previousLayerBiasIDs, currentLayerBiasIDs);

        });
    }

    // Output layer
    tf.tidy(() => {
        const outputLayer = tf.layers.dense({
            units: genome.outputLayerGenes[0].numberOfNeurons,
            activation: activationTypeToString(genome.outputLayerGenes[0].activationType),
            biasInitializer: 'heNormal'
        });
        model.add(outputLayer);
        let weightsBiases = outputLayer.getWeights();
        genome.outputLayerGenes[0].biases = weightsBiases[1].arraySync().map(b => ({ id: biasID++, value: b }));

        genome.outputLayerGenes[0].weights = weightsBiases[0].arraySync().map((wRow, rowIndex) =>
            wRow.map((w, colIndex) => ({
                fromNodeID: previousLayerBiasIDs[rowIndex],
                toNodeID: genome.outputLayerGenes[0].biases[colIndex].id,
                value: w
            }))
        );

        // weightsBiases.forEach(tensor => tensor.dispose());
    });

    // Check if usedBiasIDs already contains values outside of the range of biasID, and keep them in a temp array, populate usedBiasIDs with values from biasID, then add the temp array back to usedBiasIDs
    let tempUsedBiasIDs = [];
    if (genome.usedBiasIDs) {
        for (let i = 0; i < genome.usedBiasIDs.length; i++) {
            if (genome.usedBiasIDs[i] >= biasID) {
                tempUsedBiasIDs.push(genome.usedBiasIDs[i]);
            }
        }
        genome.usedBiasIDs = Array.from({ length: biasID }, (_, i) => i);
        genome.usedBiasIDs.push(...tempUsedBiasIDs);
    } else {
        genome.usedBiasIDs = Array.from({ length: biasID }, (_, i) => i);
    }

    return model;
}

function constructModelFromGenome(genome) {
    const model = tf.sequential();

    // Extract the number of input neurons from the genome.
    const inputNeurons = genome.inputLayerGenes[0].numberOfNeurons;

    // Input layer.
    const inputLayer = tf.layers.dense({
        units: inputNeurons,
        inputShape: [genome.inputLayerGenes[0].inputs.length],
        activation: activationTypeToString(genome.inputLayerGenes[0].activationType)
    });
    model.add(inputLayer);

    // Create a mapping from bias IDs to their respective values for the first (input) layer.
    let previousLayerBiasIDMap = {};
    genome.inputLayerGenes[0].biases.forEach(b => previousLayerBiasIDMap[b.id] = b.value);

    // Set the weights and biases for each subsequent layer based on the ID mapping.
    genome.layerGenes.forEach(layerGene => {
        const layer = tf.layers.dense({
            units: layerGene.numberOfNeurons,
            activation: activationTypeToString(layerGene.activationType)
        });
        model.add(layer);

        // Create a 2D array for the weight values initialized to 0, using the number of neurons in the previous and current layer.
        const weightsMatrix = new Array(Object.keys(previousLayerBiasIDMap).length).fill(null).map(() => new Array(layerGene.biases.length).fill(0));
        const biasesArray = new Array(layerGene.biases.length).fill(0);

        // Populate the weight matrix using the 'fromNodeID' and 'toNodeID'.
        layerGene.weights.forEach((weightRow, rowIndex) => {
            weightRow.forEach(weight => {
                const fromIndex = Object.keys(previousLayerBiasIDMap).indexOf(weight.fromNodeID.toString());
                const toIndex = layerGene.biases.findIndex(b => b.id === weight.toNodeID);
                if (fromIndex !== -1 && toIndex !== -1) {
                    weightsMatrix[fromIndex][toIndex] = weight.value;
                }
            });
        });

        // Populate the biases array using the ID mapping.
        layerGene.biases.forEach((b, index) => biasesArray[index] = b.value);

        // Apply the weight and bias values to the model layer.
        tf.tidy(() => {
            layer.setWeights([
                tf.tensor(weightsMatrix),
                tf.tensor1d(biasesArray)
            ]);
        });

        // Update the 'previousLayerBiasIDMap' for the next iteration.
        previousLayerBiasIDMap = {};
        layerGene.biases.forEach(b => previousLayerBiasIDMap[b.id] = b.value);
    });

    // Output Layer
    const outputLayerGene = genome.outputLayerGenes[0];
    const outputLayer = tf.layers.dense({
        units: outputLayerGene.numberOfNeurons,
        activation: activationTypeToString(outputLayerGene.activationType)
    });
    model.add(outputLayer);

    // Create a 2D array for the weight values initialized to 0, using the number of neurons in the previous and current layer.
    const outputWeightsMatrix = new Array(Object.keys(previousLayerBiasIDMap).length).fill(null).map(() => new Array(outputLayerGene.biases.length).fill(0));
    const outputBiasesArray = new Array(outputLayerGene.biases.length).fill(0);

    // Populate the weight matrix using the 'fromNodeID' and 'toNodeID'.
    outputLayerGene.weights.forEach((weightRow, rowIndex) => {
        weightRow.forEach(weight => {
            const fromIndex = Object.keys(previousLayerBiasIDMap).indexOf(weight.fromNodeID.toString());
            const toIndex = outputLayerGene.biases.findIndex(b => b.id === weight.toNodeID);
            if (fromIndex !== -1 && toIndex !== -1) {
                outputWeightsMatrix[fromIndex][toIndex] = weight.value;
            }
        });
    });

    // Populate the biases array using the ID mapping.
    outputLayerGene.biases.forEach((b, index) => outputBiasesArray[index] = b.value);

    // Apply the weight and bias values to the model layer.
    tf.tidy(() => {
        outputLayer.setWeights([
            tf.tensor(outputWeightsMatrix),
            tf.tensor1d(outputBiasesArray)
        ]);
    });


    return model;
}


function activationTypeToString(type) {
    const types = ["relu", "sigmoid", "tanh"]; // add other types as needed
    return types[type];
}

function nextAgentgroupNEAT(p) {

    //if (framesPerUpdateStart > 1) {
    //    framesPerUpdateStart--;
    //}

    currentProcess = "Filtering batch from total pool";

    // OTT manual disposal and destruction of all bodies and joints
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

        agent.brain.dispose();
        agent.joints = [];
        agent.limbs = [];
        agent.mainBody = null;
    }

    agents = [];  // Reset the agents array

    // let populationGenomes equal a selection of totalPopulationGenomes based on the agentGenomePool[i].metadata.runGroup. Can use the inter generation run counter runCount for the search
    let populationGenomes = agentGenomePool.filter(genome => genome.metadata.runGroup === runCount);

    // Initialize agents in batches
    if (Array.isArray(populationGenomes) && populationGenomes.length === popSize) {
        for (let i = 0; i < popSize; i += BATCH_SIZE) {
            initializeAgentBatchNEAT(i, Math.min(i + BATCH_SIZE, popSize), populationGenomes);
        }
    } else {
        console.log("Issue with population genomes");
    }

    waitForInitializationCompletionBatchNEAT();

    console.log('Restarting simulation with next set of agents!');

    // Reset simulation
    // await new Promise(resolve => setTimeout(resolve, 1000));
    displayedTimeLeft = (simulationLengthModified - tickCount) * (1 / simulationSpeed);
    stabilityCounter = 0;
    tickCount = 0;
    nextBatchFrame = 1;
    currentPhysicsBatch = 0;
    // p.loop();
}

function waitForInitializationCompletionBatchNEAT(populationGenomes) {
    // Check if the condition is met
    if (agents.length >= popSize) {
        runCount++;
        currentProcess = "Starting next round";

        populationGenomes = [];
        randomlySelectedAgents = [];
        for (let groupId = 0; groupId < numGroups; groupId++) {
            let groupAgentsForRender = agents.filter(agent => agent.genome.metadata.agentGroup === groupId);

            // Select few random agents
            for (let i = 0; i < renderedAgents; i++) {
                let randomIndex = Math.floor(Math.random() * groupAgentsForRender.length);
                randomlySelectedAgents.push(groupAgentsForRender[randomIndex]);
            }
        }

        isInitializationComplete = true;

        console.log('Number of tensors after restart:', tf.memory().numTensors, 'Tensor Mem after restart', tf.memory().numBytes);
        console.log("Number of bodies:", world.getBodyCount());
        console.log("Number of joints:", world.getJointCount());
        offsetX = 0;

    } else {
        // If the condition is not met, wait for some time and check again
        setTimeout(() => waitForInitializationCompletionBatchNEAT(), 100); // Checking every 100ms for example
    }
}

function nextGenerationNEAT(p) {

    usedIndices = new Set();
    if (framesPerUpdateStart > 1) {
        framesPerUpdateStart--;
    }
    runCount = 0;
    currentProcess = "Performing Crossover, Mutation, and Selection on total population to create offspring";

    if (randomMapSelector) {
        randMap = Math.floor(Math.random() * 5);
        createMaps(randMap);
    }

    // calculate average network 'pattern'
    // Will need to create a NEAT version of calculateAllAverageDistances to handle different brain shapes
    // let averageBrain = calculateAllAverageDistances();

    // loop through all agents scores and log them
    for (let i = 0; i < agents.length; i++) {
        let thisScore = agents[i].getScore(false)[0];

        // Store the score only if the generation is a multiple of STORE_EVERY_N_GENERATIONS
        if (genCount % 5 === 0) {
            agents[i].genome.agentHistory.scoreHistory.push({ score: thisScore, map: randMap, generation: genCount });
        }

        agents[i].genome.agentHistory.rankInPop = (i + 1);

        if (thisScore > agents[i].genome.metadata.bestScore) {
            agents[i].genome.metadata.bestScore = thisScore;
        }
    }

    // OTT manual disposal and destruction of all bodies and joints
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

        agent.brain.dispose();
        agent.joints = [];
        agent.limbs = [];
        agent.mainBody = null;
    }

    agents = [];  // Reset the agents array

    // Sort in descending order of score, including the bonus for being different from the average.
    tempAgentPool.sort((a, b) => {
        const aScore = a.getScore(true)[0];
        const bScore = b.getScore(true)[0];
        // Will need to create a NEAT version of distanceToAverage to handle different brain shapes
        // const aDistance = distanceToAverage(a, averageBrain[a.genome.metadata.agentGroup]) / 100;
        // const bDistance = distanceToAverage(b, averageBrain[b.genome.metadata.agentGroup]) / 100;
        const aDistance = 0;
        const bDistance = 0;
        // Adjust the score with the distance to the average brain
        const aTotal = aScore + aDistance ** 2 * 1;
        const bTotal = bScore + bDistance ** 2 * 1;

        // Sort in descending order
        return bTotal - aTotal;
    });

    //console.log("Top Agents this round!");
    //for (let i = 0; i < Math.round(topPerformerNo * popSize); i++) {
    //    console.log(agents[i].index);
    //}

    function buildAgentGroups(groupId) {
        // Base case to end the recursion
        if (groupId >= numGroups) {
            console.log('All groups built.');
            return;
        }

        // Build the current agent group
        buildNewAgentGroup(groupId, () => {
            // Callback function to be executed once the current group is completely built
            // Move to the next group
            buildAgentGroups(groupId + 1);
        });
    }

    function buildNewAgentGroup(groupId, callback) {

        let groupAgents = tempAgentPool.filter(agent => agent.genome.metadata.agentGroup === groupId);

        for (let i = 0; i < groupAgents.length; i++) {
            groupAgents[i].genome.agentHistory.rankInGroup = i + 1;
        }
        let agentsNeeded = Math.floor((numAgentsMultiplier * popSize) / numGroups);

        // Not a good way to do this, but this line checks if our rounding is going to produce an off by 1 error
        // Could switch back to using the number of agents already present in the group to determine how many agents are needed, but this was causing inconsistencies for a while.
        if (groupAgents.length == agentsNeeded + 1) {
            agentsNeeded += 1;
        }

        let topPerformersCount = Math.floor(topPerformerNo * agentsNeeded);

        createTopPerformersNEAT(groupAgents, topPerformersCount);
        generateOffspringNEAT(groupAgents, groupId, topPerformersCount, agentsNeeded);

        // Check for the condition to see if the current group is completely built
        function checkGroupBuilt() {
            if (tempAgentGenomePool.filter(agentGenome => agentGenome.metadata.agentGroup === groupId).length >= agentsNeeded) {
                groupAgents = [];
                // If condition is met, execute callback (which will build the next group)
                callback();
            } else {
                // If condition is not met, wait for a bit and check again
                setTimeout(checkGroupBuilt, 100);
            }
        }

        // Start checking
        checkGroupBuilt();
    }

    // Start building from the first group
    buildAgentGroups(0);

    waitForInitializationCompletionNEAT();

    console.log('Restarting simulation with evolved agents!');

    // Increase the time per generation up to about 15 mins
    if (increaseTimePerGen && simulationLengthModified < maxSimulationLengthCount) {
        // simulationLengthModified += simulationLengthModified * 0.005;
        simulationLengthModified += simulationLengthIncreaseCount;
    }

    // Reset simulation
    // await new Promise(resolve => setTimeout(resolve, 1000));
    displayedTimeLeft = (simulationLengthModified - tickCount) * (1 / simulationSpeed);
    stabilityCounter = 0;
    tickCount = 0;
    nextBatchFrame = 1;
    currentPhysicsBatch = 0;
    genCount++;
    // p.loop();
}

// Recursive function checking if agents have finished loading into world
function waitForInitializationCompletionNEAT() {
    // Check if the condition is met
    if (tempAgentGenomePool.length >= popSize * numAgentsMultiplier) {

        agentGenomePool = [];

        agentGenomePool = [...tempAgentGenomePool.map(agentGenome => _.cloneDeep(agentGenome))];

        currentProcess = "Selecting batch from offspring";

        // OTT manual disposal and destruction of all bodies and joints
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

            agent.brain.dispose();
            agent.joints = [];
            agent.limbs = [];
            agent.mainBody = null;
        }

        agents = [];  // Reset the agents array

        // Randomize the order of the agentGenomePool
        agentGenomePool = _.shuffle(agentGenomePool);

        // Assign all agents a runGroup from 0 to numAgentsMultiplier, making sure each group has the same number of agents
        for (let i = 0; i < agentGenomePool.length; i++) {
            agentGenomePool[i].metadata.runGroup = i % numAgentsMultiplier;
        }

        // let populationGenomes equal a selection of totalPopulationGenomes based on the agentGenomePool[i].metadata.runGroup. Can use the inter generation run counter runCount for the search
        let populationGenomes = agentGenomePool.filter(genome => genome.metadata.runGroup === runCount);

        // Initialize agents in batches
        if (Array.isArray(populationGenomes) && populationGenomes.length === popSize) {
            for (let i = 0; i < popSize; i += BATCH_SIZE) {
                initializeAgentBatchNEAT(i, Math.min(i + BATCH_SIZE, popSize), populationGenomes);
            }
        } else {
            console.log("Issue with population genomes");
        }

        waitForFinalInitializationCompletionNEAT();

    } else {
        // If the condition is not met, wait for some time and check again
        setTimeout(() => waitForInitializationCompletionNEAT(), 100); // Checking every 100ms for example
    }
}

function waitForFinalInitializationCompletionNEAT() {
    // Check if the condition is met
    if (agents.length >= popSize) {

        currentProcess = "Starting next generation";

        // OTT manual disposal and destruction of all bodies and joints
        for (let agent of tempAgentPool) {
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

            agent.brain.dispose();
            agent.joints = [];
            agent.limbs = [];
            agent.mainBody = null;
        }

        tempAgentGenomePool = [];
        tempAgentPool = [];

        // Randomly select agents to render for each group
        randomlySelectedAgents = [];
        for (let groupId = 0; groupId < numGroups; groupId++) {

            // Re-filter by group
            let newGroupAgents = agents.filter(agent => agent.genome.metadata.agentGroup === groupId);

            // Select few random agents
            for (let i = 0; i < renderedAgents; i++) {
                let randomIndex = Math.floor(Math.random() * newGroupAgents.length);
                randomlySelectedAgents.push(newGroupAgents[randomIndex]);
            }
        }
        runCount++;
        isInitializationComplete = true;
        console.log('Number of tensors after restart:', tf.memory().numTensors, 'Tensor Mem after restart', tf.memory().numBytes);
        console.log("Number of bodies:", world.getBodyCount());
        console.log("Number of joints:", world.getJointCount());
        offsetX = 0;

    } else {
        // If the condition is not met, wait for some time and check again
        setTimeout(() => waitForFinalInitializationCompletionNEAT(), 100); // Checking every 100ms for example
    }
}


// Create top performers for the next generation
function createTopPerformersNEAT(groupAgents, topPerformersCount) {

    for (let j = 0; j < topPerformersCount; j++) {
        let oldAgent = groupAgents[j];
        usedIndices.add(oldAgent.index);

        let newAgentGenome = _.cloneDeep(oldAgent.genome);

        newAgentGenome.metadata.agentGroup = oldAgent.genome.metadata.agentGroup;
        newAgentGenome.agentHistory.roundsAsTopPerformer++;

        tempAgentGenomePool.push(newAgentGenome);
    }
}

// Function to generate offspring for the next generation
function generateOffspringNEAT(groupAgents, groupId, topPerformerCount, agentsNeeded) {

    let agentsalreadycreated = tempAgentGenomePool.filter(agentGenome => agentGenome.metadata.agentGroup === groupId).length;

    if (agentsalreadycreated >= agentsNeeded) {

        // All agents for this group have been created
        return;

    } else if (agentsalreadycreated >= topPerformerCount) {

        createAgentGroup(groupAgents, groupId, agentsNeeded);

    }
}

function createAgentGroup(groupAgents, groupId, agentsNeeded) {

    // Select 2 parents, using different methods for varying outcomes
    let parent1 = selectAgentNEAT(groupAgents, tempAgentPool);
    let parent2 = selectAgentWeightedNEAT(groupAgents, tempAgentPool, parent1);

    parent1.genome.agentHistory.usedAsParent++;
    parent2.genome.agentHistory.usedAsParent++;

    let childGenome;

    if (Math.random() < 0.5) {
        childGenome = biasedArithmeticCrossoverNEAT(parent1, parent2);
    } else {
        childGenome = randomSelectionCrossoverNEAT(parent1, parent2);
    }

    // Crossover the body plan
    childGenome = bodyPlanCrossover(childGenome, parent1, parent2);

    // Code to update mutation rate commented for now as highly inefficient. It was adding 10 seconds + to the start of each round.
    // childBrain.mutationRate = updateMutationRate(childBrain.mutationRate, averageBrain)

    childGenome = mutateGenome(childGenome, childGenome.hyperparameters.mutationRate, childGenome.hyperparameters.nodeMutationRate, childGenome.hyperparameters.layerMutationRate);

    childGenome = mutateBodyPlan(childGenome, childGenome.hyperparameters.limbMutationRate);

    // Decay all weights in the brain by a small amount
    if (brainDecay) {
        childGenome = decayWeights(childGenome);
    }

    let agentIndex = 0;

    // Find the next unused index
    while (usedIndices.has(agentIndex)) {
        agentIndex++;
    }

    usedIndices.add(agentIndex);  // Mark this index as used
    // set childAgent.genome.metadata.agentName to combination of parent names, first 3 letters from dominant parent, last 3 from recessive
    let parent1Name = parent1.genome.metadata.agentName;
    let parent2Name = parent2.genome.metadata.agentName;
    let childName = parent1Name.substring(0, 3) + parent2Name.substring(parent2Name.length - 3, parent2Name.length);
    childGenome.metadata.agentName = childName;
    childGenome.metadata.agentGroup = groupId;

    // Once an agent is created, add to agent pool
    tempAgentGenomePool.push(childGenome);
    if (tempAgentGenomePool.filter(agentGenome => agentGenome.metadata.agentGroup === groupId).length < agentsNeeded) {
        // Schedule the next agent creation after a short timeout
        setTimeout(() => {
            createAgentGroup(groupAgents, groupId, agentsNeeded);
        }, 10);  // Adjust the timeout value as needed
    } else {
        return;
    }
}

function selectAgentNEAT(groupAgents, allAgents, excludedAgent = null) {
    // Occasionally pick from the entire population
    if (Math.random() < CROSS_GROUP_PROBABILITY) {
        groupAgents = allAgents;
    }

    // Tournament Selection
    let tournamentContestants = [];

    for (let i = 0; i < TOURNAMENT_SIZE; i++) {
        let randomAgent;
        do {
            randomAgent = groupAgents[Math.floor(Math.random() * groupAgents.length)];
        } while (tournamentContestants.includes(randomAgent) || randomAgent == excludedAgent);
        tournamentContestants.push(randomAgent);
    }

    // Return the agent with the highest score from the tournament contestants
    return tournamentContestants.sort((a, b) => b.getScore(true)[0] - a.getScore(true)[0])[0];
}

function selectAgentWeightedNEAT(agentsLocal, allAgents, excludedAgent = null) {
    // Occasionally pick from the entire population
    if (Math.random() < CROSS_GROUP_PROBABILITY) {
        agentsLocal = allAgents;
    }

    let normalizedScores = [];
    let minScore = Math.min(...agentsLocal.map(agent => parseFloat(agent.getScore(true)[0])));

    // Ensure all scores are positive
    let offsetScore = minScore < 0 ? Math.abs(minScore) : 0;

    let cumulativeSum = 0;
    for (let agent of agentsLocal) {
        if (agent != excludedAgent) {
            let score = parseFloat(agent.getScore(true)[0]) + offsetScore;
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

function biasedArithmeticCrossoverNEAT(agent1, agent2) {

    genome1 = agent1.genome;
    genome2 = agent2.genome;

    let score1 = agent1.getScore(true);
    let TScore1 = parseFloat(score1[0]);

    let score2 = agent2.getScore(true);
    let TScore2 = parseFloat(score2[0]);

    let totalScore = TScore1 + TScore2;

    if (Math.abs(totalScore) < 1e-5) {
        return genome1;
    }

    let alpha = 1 * TScore1 / totalScore;
    let beta = 1 * TScore2 / totalScore;

    let dominantGenome = (TScore1 > TScore2) ? genome1 : genome2;
    let subGenome = (TScore1 < TScore2) ? genome1 : genome2;


    let childGenome = _.cloneDeep(dominantGenome);

    // Input Layer
    for (const bias of childGenome.inputLayerGenes[0].biases) {
        let id = bias.id;
        try {
            let bias1 = genome1.inputLayerGenes[0].biases.find(b => b.id === id);
            let bias2 = genome2.inputLayerGenes[0].biases.find(b => b.id === id);
            if (bias1 && bias2) {
                bias.value = (alpha * bias1.value) + (beta * bias2.value);
            }
        } catch (e) {
            // console.log("Trying to perform crossover on non matching input nodes, continuing...");
        }
    }

    // Hidden Layers
    for (const layer of childGenome.layerGenes) {
        let layerID = layer.layerID;
        try {
            let layer1 = genome1.layerGenes.find(l => l.layerID === layerID);
            let layer2 = genome2.layerGenes.find(l => l.layerID === layerID);

            if (layer1 && layer2) {
                for (const [j, weights] of layer.weights.entries()) {
                    for (const [k, weight] of weights.entries()) {
                        let fromNodeID = weight.fromNodeID;
                        let toNodeID = weight.toNodeID;
                        try {
                            let weight1 = layer1.weights[j].find(w => w.fromNodeID === fromNodeID && w.toNodeID === toNodeID);
                            let weight2 = layer2.weights[j].find(w => w.fromNodeID === fromNodeID && w.toNodeID === toNodeID);
                            if (weight1 && weight2) {
                                weight.value = (alpha * weight1.value) + (beta * weight2.value);
                            }
                        } catch (e) {
                            // console.log("Trying to perform crossover on non matching nodes, continuing...");
                        }
                    }
                }
                for (const [j, bias] of layer.biases.entries()) {
                    let id = bias.id;
                    try {
                        let bias1 = layer1.biases.find(b => b.id === id);
                        let bias2 = layer2.biases.find(b => b.id === id);
                        if (bias1 && bias2) {
                            bias.value = (alpha * bias1.value) + (beta * bias2.value);
                        }
                    } catch (e) {
                        // console.log("Trying to perform crossover on non matching nodes, continuing...");
                    }
                }
            }

        } catch (e) {
            // console.log("Trying to perform crossover on non matching layers, continuing...");
        }
    }

    // Output Layer
    for (const [j, weights] of childGenome.outputLayerGenes[0].weights.entries()) {
        for (const [k, weight] of weights.entries()) {
            let fromNodeID = weight.fromNodeID;
            let toNodeID = weight.toNodeID;
            try {
                let weight1 = genome1.outputLayerGenes[0].weights[j].find(w => w.fromNodeID === fromNodeID && w.toNodeID === toNodeID);
                let weight2 = genome2.outputLayerGenes[0].weights[j].find(w => w.fromNodeID === fromNodeID && w.toNodeID === toNodeID);
                if (weight1 && weight2) {
                    weight.value = (alpha * weight1.value) + (beta * weight2.value);
                }
            } catch (e) {
                // console.log("Trying to perform crossover on non matching output nodes, continuing...");
            }
        }
    }
    for (const bias of childGenome.outputLayerGenes[0].biases) {
        let id = bias.id;
        try {
            let bias1 = genome1.outputLayerGenes[0].biases.find(b => b.id === id);
            let bias2 = genome2.outputLayerGenes[0].biases.find(b => b.id === id);
            if (bias1 && bias2) {
                bias.value = (alpha * bias1.value) + (beta * bias2.value);
            }
        } catch (e) {
            // console.log("Trying to perform crossover on non matching output nodes, continuing...");
        }
    }

    return childGenome;
}

function randomSelectionCrossoverNEAT(agent1, agent2) {

    genome1 = agent1.genome;
    genome2 = agent2.genome;

    let score1 = agent1.getScore(true);
    let TScore1 = parseFloat(score1[0]);
    let score2 = agent2.getScore(true);
    let TScore2 = parseFloat(score2[0]);

    let dominantGenome = (TScore1 > TScore2) ? genome1 : genome2;
    let subGenome = (TScore1 < TScore2) ? genome1 : genome2;
    let childGenome = _.cloneDeep(dominantGenome);

    // Input Layer
    for (const bias of childGenome.inputLayerGenes[0].biases) {
        let id = bias.id;
        try {
            let parent = Math.random() > 0.5 ? genome1 : genome2;
            let newBias = parent.inputLayerGenes[0].biases.find(b => b.id === id);
            if (newBias) {
                bias.value = newBias.value;
            }
        } catch (e) {
           //  console.log("Trying to perform crossover on non matching Input nodes, continuing...");
        }
    }

    // Hidden Layers
    for (const layer of childGenome.layerGenes) {
        let layerID = layer.layerID;

        for (const [j, weights] of layer.weights.entries()) {
            for (const [k, weight] of weights.entries()) {
                let fromNodeID = weight.fromNodeID;
                let toNodeID = weight.toNodeID;
                try {
                    let parent = Math.random() > 0.5 ? genome1 : genome2;
                    let newWeight = parent.layerGenes
                        .find(l => l.layerID === layerID)
                        .weights[j]
                        .find(w => w.fromNodeID === fromNodeID && w.toNodeID === toNodeID);
                    if (newWeight) {
                        weight.value = newWeight.value;
                    }
                } catch (e) {
                    // console.log("Trying to perform crossover on non matching nodes, continuing...");
                }
            }
        }
        for (const [j, bias] of layer.biases.entries()) {
            let id = bias.id;
            try {
                let parent = Math.random() > 0.5 ? genome1 : genome2;
                let newBias = parent.layerGenes.find(l => l.layerID === layerID).biases.find(b => b.id === id);
                if (newBias) {
                    bias.value = newBias.value;
                }
            } catch (e) {
                // console.log("Trying to perform crossover on non matching nodes, continuing...");
            }
        }
    }

    // Output Layer
    for (const [j, weights] of childGenome.outputLayerGenes[0].weights.entries()) {
        for (const [k, weight] of weights.entries()) {
            let fromNodeID = weight.fromNodeID;
            let toNodeID = weight.toNodeID;
            try {
                let parent = Math.random() > 0.5 ? genome1 : genome2;
                let newWeight = parent.outputLayerGenes[0]
                    .weights[j]
                    .find(w => w.fromNodeID === fromNodeID && w.toNodeID === toNodeID);
                if (newWeight) {
                    weight.value = newWeight.value;
                }
            } catch (e) {
                // console.log("Trying to perform crossover on non matching output nodes, continuing...");
            }
        }
    }
    for (const bias of childGenome.outputLayerGenes[0].biases) {
        let id = bias.id;
        try {
            let parent = Math.random() > 0.5 ? genome1 : genome2;
            let newBias = parent.outputLayerGenes[0].biases.find(b => b.id === id);
            if (newBias) {
                bias.value = newBias.value;
            }
        } catch (e) {
            // console.log("Trying to perform crossover on non matching output nodes, continuing...");
        }
    }
    return childGenome;
}

function bodyPlanCrossover(childGenome, agent1, agent2) {

    // Determine which parent is dominant based on score
    const isParent1Dominant = agent1.getScore(true)[0] > agent2.getScore(true)[0];
    const dominantParent = isParent1Dominant ? agent1 : agent2;
    const submissiveParent = isParent1Dominant ? agent2 : agent1;

    let dominantParentGenome = dominantParent.genome;
    let submissiveParentGenome = submissiveParent.genome;

    // Randomly select the main body size from one of the parents
    childGenome.bodyPlan.mainBody.size = Math.random() < 0.5 ? dominantParentGenome.bodyPlan.mainBody.size : submissiveParentGenome.bodyPlan.mainBody.size;

    // Check for each limb in the child genome whether to keep it or swap it
    childGenome.bodyPlan.limbs.forEach((limb, idx) => {
        // If there's a corresponding limb in both parents, decide whether to swap
        if (dominantParentGenome.bodyPlan.limbs[idx] && submissiveParentGenome.bodyPlan.limbs[idx]) {
            if (Math.random() < 0.5) {
                childGenome.bodyPlan.limbs[idx] = _.cloneDeep(submissiveParentGenome.bodyPlan.limbs[idx]);
                // childGenome.agentHistory.mutations.push("type: limb, mutation: swap from parent: " + submissiveParentGenome.metadata.agentName);
            }
        }

        // If the limb exists in the childGenome (i.e., it was not swapped out), recalculate attachment points
        if (childGenome.bodyPlan.limbs[idx]) {
            childGenome.bodyPlan.limbs[idx].attachment.x = childGenome.bodyPlan.mainBody.size * Math.cos(childGenome.bodyPlan.limbs[idx].startingAngle);
            childGenome.bodyPlan.limbs[idx].attachment.y = childGenome.bodyPlan.mainBody.size * Math.sin(childGenome.bodyPlan.limbs[idx].startingAngle);
        }
    });

    return childGenome;
}

// Generate a unique ID
function generateUniqueId(usedIds) {
    let newId;
    do {
        newId = 1000 + Math.floor(Math.random() * 1000000);
    } while (usedIds.includes(newId));
    usedIds.push(newId);
    return newId;
}

function mutateGenome(genome, mutationRate, nodeMutationRate, layerMutationRate) {
    let stdDeviation = 0.1;

    function mutateValues(values) {
        if (Array.isArray(values[0])) {
            // Handle nested arrays (2D, ...)
            for (let i = 0; i < values.length; i++) {
                mutateValues(values[i]);
            }
        } else {
            // 1D array
            for (let i = 0; i < values.length; i++) {
                if (Math.random() < mutationRate) {
                    let adjustment = randomGaussian(0, stdDeviation);
                    values[i].value += adjustment;
                }
            }
        }
    }

    function randomGaussian(mean, sd) {
        let u1 = Math.random();
        let u2 = Math.random();
        let randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
        return mean + sd * randStdNormal;
    }

    // Mutate Input Layer Biases
    mutateValues(genome.inputLayerGenes[0].biases);

    // Mutate Hidden Layers Weights and Biases
    for (let i = 0; i < genome.layerGenes.length; i++) {
        for (let j = 0; j < genome.layerGenes[i].weights.length; j++) {
            mutateValues(genome.layerGenes[i].weights[j]);
        }
        mutateValues(genome.layerGenes[i].biases);
    }

    // Mutate Output Layer Weights and Biases
    for (let j = 0; j < genome.outputLayerGenes[0].weights.length; j++) {
        mutateValues(genome.outputLayerGenes[0].weights[j]);
    }
    mutateValues(genome.outputLayerGenes[0].biases);

    // Node mutation (add or remove node)
    if (Math.random() < nodeMutationRate) {
        let randomLayerIndex = Math.floor(Math.random() * genome.layerGenes.length);
        let randomLayer = genome.layerGenes[randomLayerIndex];
        let randomNodeIndex = Math.floor(Math.random() * (randomLayer.biases.length + 1));


        // decide to add or remove a node with equal probability
        if (Math.random() < 0.5 || randomLayer.biases.length === 1) {
            // Add a node
            let newBiasId = generateUniqueId(genome.usedBiasIDs);
            randomLayer.biases.splice(randomNodeIndex, 0, { id: newBiasId, value: Math.random() });
            randomLayer.numberOfNeurons++;

            genome.agentHistory.mutations.push("type: node, layer: " + randomLayerIndex + " id: " + newBiasId + " mutation: add");

            if (randomLayerIndex === 0) {
                // If it's the first hidden layer, link weights from input layer to the new node
                genome.inputLayerGenes[0].biases.forEach((bias, idx) => {
                    randomLayer.weights[idx].splice(randomNodeIndex, 0, {
                        fromNodeID: bias.id,
                        toNodeID: newBiasId,
                        value: Math.random()
                    });
                });
            } else {
                // Link weights from all nodes in the previous hidden layer to the new node
                let prevLayer = genome.layerGenes[randomLayerIndex - 1];
                prevLayer.biases.forEach((bias, idx) => {
                    randomLayer.weights[idx].splice(randomNodeIndex, 0, {
                        fromNodeID: bias.id,
                        toNodeID: newBiasId,
                        value: Math.random()
                    });
                });
            }

            // Link weights from the new node to all nodes in the next layer
            let nextLayer = (randomLayerIndex === genome.layerGenes.length - 1) ? genome.outputLayerGenes[0] : genome.layerGenes[randomLayerIndex + 1];
            let newWeightArray = nextLayer.biases.map(bias => ({
                fromNodeID: newBiasId,
                toNodeID: bias.id,
                value: Math.random()
            }));
            nextLayer.weights.splice(randomNodeIndex, 0, newWeightArray);

        } else {
            // Remove a node
            if (randomLayer.biases.length > 1) {

                try {
                    let removedBiasId = randomLayer.biases[randomNodeIndex].id;
                    genome.agentHistory.mutations.push("type: node, layer: " + randomLayerIndex + " id: " + removedBiasId + " mutation: remove");

                    randomLayer.biases.splice(randomNodeIndex, 1);
                    randomLayer.numberOfNeurons--;

                    randomLayer.weights.forEach(weightArray => {
                        let idxToRemove = weightArray.findIndex(w => w.toNodeID === removedBiasId);
                        if (idxToRemove !== -1) weightArray.splice(idxToRemove, 1);
                    });

                    // Removing the weights from the removed node to the next layer
                    if (randomLayerIndex < genome.layerGenes.length - 1) {
                        let nextLayer = genome.layerGenes[randomLayerIndex + 1];
                        let idxToRemove = nextLayer.weights.findIndex(weightArray => weightArray.some(w => w.fromNodeID === removedBiasId));
                        if (idxToRemove !== -1) nextLayer.weights.splice(idxToRemove, 1);
                    }
                    else {
                        let idxToRemove = genome.outputLayerGenes[0].weights.findIndex(weightArray => weightArray.some(w => w.fromNodeID === removedBiasId));
                        if (idxToRemove !== -1) genome.outputLayerGenes[0].weights.splice(idxToRemove, 1);
                    }

                } catch (e) {

                    genome.agentHistory.mutations.push("type: node, layer: " + randomLayerIndex + " id: " + randomNodeIndex + "Not Found, skipping mutation");

                }

            }
        }
    }

    // Layer mutation
    if (Math.random() < layerMutationRate) {
        if (Math.random < 0.6) {
            // Add a layer
            // Randomly select a hidden layer to duplicate
            let randomLayerIndex = Math.floor(Math.random() * genome.layerGenes.length);
            let layerToDuplicate = genome.layerGenes[randomLayerIndex];

            // Create a deep copy of the layer
            let duplicatedLayer = _.cloneDeep(layerToDuplicate);

            // Map old IDs to new unique IDs
            let idMap = {};
            duplicatedLayer.biases.forEach(bias => {
                let oldID = bias.id;
                bias.id = generateUniqueId(genome.usedBiasIDs);
                idMap[oldID] = bias.id;
            });

            // Generate new weights for the duplicated layer
            let newWeights = [];
            layerToDuplicate.biases.forEach((oldBias, index) => {
                let weightArray = [];
                duplicatedLayer.biases.forEach(newBias => {
                    if (newBias.id == idMap[oldBias.id]) {
                        weightArray.push({ fromNodeID: oldBias.id, toNodeID: newBias.id, value: 1 });
                    } else {
                        weightArray.push({ fromNodeID: oldBias.id, toNodeID: newBias.id, value: 0 });
                    }
                });
                newWeights.push(weightArray);
            });
            duplicatedLayer.weights = newWeights;

            // Update connections of subsequent layers to point to the new layer
            if (randomLayerIndex < genome.layerGenes.length - 1) {
                let nextLayer = genome.layerGenes[randomLayerIndex + 1];
                nextLayer.weights.forEach(weightArray => {
                    weightArray.forEach(weight => {
                        weight.fromNodeID = idMap[weight.fromNodeID] || weight.fromNodeID;
                    });
                });
            } else {
                // If we duplicated the last hidden layer, update the output layer
                genome.outputLayerGenes[0].weights.forEach(weightArray => {
                    weightArray.forEach(weight => {
                        weight.fromNodeID = idMap[weight.fromNodeID] || weight.fromNodeID;
                    });
                });
            }

            // Insert the duplicated layer after the original layer
            genome.layerGenes.splice(randomLayerIndex + 1, 0, duplicatedLayer);

            // Loop through hidden layers and update the layerIDs to be sequential from 0
            genome.layerGenes.forEach((layer, idx) => layer.layerID = idx);

            genome.agentHistory.mutations.push("type: layer, new layer after layer: " + randomLayerIndex + " mutation: add copy");

        } else {
            // Remove a layer
            if (genome.layerGenes.length > 2) {
                // 1. Select a Layer to Remove
                let randomLayerIndex = Math.floor(Math.random() * (genome.layerGenes.length - 1)) + 1;
                if (genome.layerGenes.length > 1) {
                    let prevLayer = genome.layerGenes[randomLayerIndex - 1];
                    let nextLayer = (randomLayerIndex === genome.layerGenes.length - 1) ? genome.outputLayerGenes[0] : genome.layerGenes[randomLayerIndex + 1];

                    // 2. Calculate New Weights
                    let newWeights = [];
                    prevLayer.biases.forEach((prevBias) => {
                        let newWeightArray = [];
                        nextLayer.biases.forEach((nextBias) => {
                            // Initialize new weight as zero
                            let newWeightValue = 0;

                            try {
                                // Loop through all nodes in the layer to be removed
                                genome.layerGenes[randomLayerIndex].biases.forEach((removedBias, removedIdx) => {
                                    // Find and accumulate the associated weight values
                                    let prevToRemovedWeight = genome.layerGenes[randomLayerIndex].weights.find(w => w.fromNodeID === prevBias.id && w.toNodeID === removedBias.id)?.value || 0;
                                    let removedToNextWeight = nextLayer.weights.find(w => w.fromNodeID === removedBias.id && w.toNodeID === nextBias.id)?.value || 0;

                                    // Sum the products of weights a->b and b->c
                                    newWeightValue += prevToRemovedWeight * removedToNextWeight;
                                });
                            } catch (e) {
                                console.error("Error in weight calculation: ", e);
                            }

                            // Assign the new weight from a to c
                            newWeightArray.push({
                                fromNodeID: prevBias.id,
                                toNodeID: nextBias.id,
                                value: newWeightValue
                            });
                        });
                        newWeights.push(newWeightArray);
                    });
                    nextLayer.weights = newWeights;

                    // 3. Remove Layer
                    genome.layerGenes.splice(randomLayerIndex, 1);

                    // Update layer IDs
                    genome.layerGenes.forEach((layer, idx) => layer.layerID = idx);

                    genome.agentHistory.mutations.push("type: layer, removed layer: " + randomLayerIndex + " mutation: remove");
                }

            } else {
                genome.agentHistory.mutations.push("type: layer, no layer to remove, mutation: remove");
            }
        }
    }

    return genome;
}

function mutateBodyPlan(childGenome, bodyMutationRate) {
    // Main Body Size Mutation
    if (Math.random() < bodyMutationRate) {
        childGenome.bodyPlan.mainBody.size = mutateWithinBounds(childGenome.bodyPlan.mainBody.size, 10, 30);
        childGenome.bodyPlan.mainBody.density = mutateWithinBounds(childGenome.bodyPlan.mainBody.density, 0.1, 1);
    }

    // Limb Properties Mutation
    childGenome.bodyPlan.limbs.forEach(limb => {
        if (Math.random() < bodyMutationRate) {
            limb.constraints.maxTorque = mutateWithinBounds(limb.constraints.maxTorque, 1000, 100000);
            limb.constraints.maxAngle = mutateWithinBounds(limb.constraints.maxAngle, Math.PI / 5, Math.PI / 2);
            limb.constraints.minAngle = mutateWithinBounds(limb.constraints.minAngle, -(Math.PI / 2), -(Math.PI / 5));
            limb.length = mutateWithinBounds(limb.length, 10, 60);
            limb.width = mutateWithinBounds(limb.width, 2, 22);
            limb.startingAngle = mutateWithinBounds(limb.startingAngle, 0, 2 * Math.PI);

        }
        // Recalculate the x and y attachments based on potential mainBody size mutation and limb angle mutation.
        limb.attachment.x = childGenome.bodyPlan.mainBody.size * Math.cos(limb.startingAngle);
        limb.attachment.y = childGenome.bodyPlan.mainBody.size * Math.sin(limb.startingAngle);
    });

    // Limb Number Mutation, half as often as other body mutations
    if (Math.random() < bodyMutationRate / 2) {
        if (Math.random() < 0.5) {

            // Should maybe look to change this so the new limb gets pre-existing weights from a different limb, so it has a starting point for learning

            // Add a new limb
            let angle = Math.random() * 2 * Math.PI;

            // Find the limb with the closest starting angle to the new limb
            let closestLimb = childGenome.bodyPlan.limbs.reduce((closest, currentLimb) => {
                let currentAngleDiff = Math.abs(currentLimb.startingAngle - angle);
                let closestAngleDiff = closest ? Math.abs(closest.startingAngle - angle) : Infinity;

                return currentAngleDiff < closestAngleDiff ? currentLimb : closest;
            }, null);

            let newLimb = {
                limbID: childGenome.bodyPlan.limbs.length,
                startingAngle: angle,
                attachment: {
                    x: childGenome.bodyPlan.mainBody.size * Math.cos(angle),
                    y: childGenome.bodyPlan.mainBody.size * Math.sin(angle)
                },
                constraints: {
                    maxTorque: Math.random() * 100000,
                    maxAngle: Math.PI / (2 + Math.floor(Math.random(4))),
                    minAngle: -Math.PI / (2 + Math.floor(Math.random(4)))
                },
                length: 10 + Math.floor(Math.random(50)),
                width: 2 + Math.floor(Math.random(20)),
            };
            childGenome.bodyPlan.limbs.push(newLimb);

            // Add a new node to the input layer for the limb
            let inputLayer = childGenome.inputLayerGenes[0];
            let inputNodeIndex = newLimb.limbID;  // Index of the node equals ID of the limb
            let inputNodeId = generateUniqueId(childGenome.usedBiasIDs);  // Generate a unique ID for this node
            inputLayer.biases.splice(inputNodeIndex, 0, { id: inputNodeId, value: Math.random() }); // Insert at index = limb ID
            inputLayer.numberOfNeurons++;
            childGenome.inputLayerGenes[0].inputs.push(childGenome.inputLayerGenes[0].inputs.length);

            // Add a new node to the output layer for the limb
            let outputLayer = childGenome.outputLayerGenes[0];
            let outputNodeID = outputLayer.biases.length; // ID of the node equals its index in the output layer
            outputLayer.biases.push({ id: outputNodeID, value: Math.random() });
            outputLayer.numberOfNeurons++;

            // Add new weights associated with the new nodes
            // For the input layer, link weights from the new input node to all nodes in the first hidden layer
            let firstHiddenLayer = childGenome.layerGenes[0];
            let lastHiddenLayer = childGenome.layerGenes[childGenome.layerGenes.length - 1];
            // Use the weights from the closest limb for the new limb, if a closest limb is found
            if (closestLimb) {
                // Assuming weights for limbs are stored in an array-like structure indexed by limbID
                let closestLimbInputWeights = firstHiddenLayer.weights[closestLimb.limbID];
                let closestLimbOutputWeights = outputLayer.weights.map(weightsArray => weightsArray[closestLimb.limbID]);

                firstHiddenLayer.weights[inputNodeIndex] = closestLimbInputWeights.map(weight => ({
                    ...weight,
                    fromNodeID: inputNodeId // Use the new unique ID here
                }));

                lastHiddenLayer.biases.forEach((bias, idx) => {
                    outputLayer.weights[idx].splice(outputNodeID, 0, {
                        ...closestLimbOutputWeights[idx],
                        toNodeID: outputNodeID
                    });
                });

                childGenome.agentHistory.mutations.push("type: limb, id: " + newLimb.limbID + " mutation: add" + "Copied weights from limb: " + closestLimb.limbID);
            } else {
                // If no closest limb is found, initialize with random weights (original behavior)
                let inputWeightArray = firstHiddenLayer.biases.map(bias => ({
                    fromNodeID: inputNodeId,  // Use the new unique ID here
                    toNodeID: bias.id,
                    value: Math.random()
                }));
                firstHiddenLayer.weights.splice(inputNodeIndex, 0, inputWeightArray);  // Insert at index = limb ID

                lastHiddenLayer.biases.forEach((bias, idx) => {
                    outputLayer.weights[idx].splice(outputNodeID, 0, {
                        fromNodeID: bias.id,
                        toNodeID: outputNodeID,
                        value: Math.random()
                    });
                });
                childGenome.agentHistory.mutations.push("type: limb, id: " + newLimb.limbID + " mutation: add" + "Used random weights");
            }


        } else {
            if (childGenome.bodyPlan.limbs.length > 1) {
                // Remove a limb
                let limbToRemoveIdx = Math.floor(Math.random() * childGenome.bodyPlan.limbs.length);

                // Remove the limb from the body plan
                childGenome.bodyPlan.limbs.splice(limbToRemoveIdx, 1);

                // Update the limbID for all limbs after the removed one
                for (let i = limbToRemoveIdx; i < childGenome.bodyPlan.limbs.length; i++) {
                    childGenome.bodyPlan.limbs[i].limbID--;
                }

                // Remove node from the input layer
                childGenome.inputLayerGenes[0].biases.splice(limbToRemoveIdx, 1);
                childGenome.inputLayerGenes[0].numberOfNeurons--;
                childGenome.inputLayerGenes[0].inputs.splice(limbToRemoveIdx, 1);

                // Remove weights connected to the removed input node from the first hidden layer
                childGenome.layerGenes[0].weights.splice(limbToRemoveIdx, 1);

                // Remove node from the output layer
                let outputLayer = childGenome.outputLayerGenes[0];
                outputLayer.biases.pop();
                outputLayer.numberOfNeurons--;

                // Remove weights connected to the removed output node in the last hidden layer
                let lastHiddenLayer = childGenome.layerGenes[childGenome.layerGenes.length - 1];
                lastHiddenLayer.weights.forEach(weightArray => {
                    weightArray.pop();
                });

                // Record the mutation into the agent's history
                childGenome.agentHistory.mutations.push("type: limb, id: " + limbToRemoveIdx + " mutation: remove");
            }
        }
    }


    return childGenome;
}

function mutateWithinBounds(original, min, max) {

    let stdDeviation = 0.2;
    let adjustment = randomGaussian(0, stdDeviation);

    function randomGaussian(mean, sd) {
        let u1 = Math.random();
        let u2 = Math.random();
        let randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
        return mean + sd * randStdNormal;
    }

    // Mutate value.
    let mutated = original + ((Math.random() - 0.5) * adjustment * (max - min));
    // Ensure mutation stays within specified bounds.
    return Math.min(max, Math.max(min, mutated));
}



function renderNeuralNetworkNEAT(p, agent, offsetX, offsetY, frameTracker) {
    let layerGap = 100; // horizontal space between layers
    let nodeGap = 30;   // vertical space between nodes
    let outputLabels = [];
    let allWeightTensors;
    let allWeights;
    let allBiasesTensors;
    let allBiases;
    p.push();
    p.fill(GROUP_COLORS[agent.genome.metadata.agentGroup]);

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
        inputLabels = inputLabels.concat(Array(agent.numLimbs).fill(null).map((_, idx) => `Ground Sensor ${idx + 1}`));
    }

    if (inputsDistanceSensors) {
        for (let i = 0; i < 8; i++) {
            inputLabels.push(`Sensor ${['E', 'NE', 'W', 'SE'][i]}`);
        }
    }

    if (outputJointSpeed) {
        outputLabels = outputLabels.concat(Array(agent.numLimbs).fill(null).map((_, idx) => `Joint ${idx + 1}`));
    }

    if (outputJointTorque) {
        outputLabels = outputLabels.concat(Array(agent.numLimbs).fill(null).map((_, idx) => `Joint ${idx + 1}`));
    }

    if (outputBias) {
        outputLabels = outputLabels.concat(Array(agent.numLimbs).fill(null).map((_, idx) => `Limb ${idx + 1}`));
    }

    allWeightTensors = agent.brain.getWeights().filter((_, idx) => idx % 2 === 0);
    allWeights = allWeightTensors.flatMap(tensor => Array.from(tensor.dataSync()));

    allBiasesTensors = agent.brain.getWeights().filter((_, idx) => idx % 2 === 1);
    allBiases = allBiasesTensors.flatMap(tensor => Array.from(tensor.dataSync()));

    let currentWeightIndex = 0;
    let currentBiasIndex = 0;

    let hiddenLayers = agent.genome.layerGenes.length;
    let inputNodes = agent.genome.inputLayerGenes[0].numberOfNeurons;
    let outputNodes = agent.genome.outputLayerGenes[0].numberOfNeurons;

    // First, render all the connections (lines)
    let x = offsetX;
    for (let i = 0; i < hiddenLayers + 2; i++) {
        let nodes = 0;
        if (i === 0) {
            nodes = inputNodes;
        } else if (i === hiddenLayers + 1) {
            nodes = outputNodes;
        } else {
            nodes = agent.genome.layerGenes[i - 1].numberOfNeurons;
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
                    currentWeightIndex++;
                    let maxWeight = Math.max(...allWeights.map(Math.abs));
                    let strokeWeightValue = mapWeightToStroke(weight, maxWeight);
                    p.stroke(255);
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
    for (let i = 0; i < hiddenLayers + 2; i++) {
        let nodes = 0;
        let labels = [];
        if (i === 0) {
            nodes = inputNodes;
            labels = inputLabels;
        } else if (i === hiddenLayers + 1) {
            nodes = outputNodes;
            labels = outputLabels;
        } else {
            nodes = agent.genome.layerGenes[i - 1].numberOfNeurons;
        }

        let startY = offsetY - ((nodes - 1) * nodeGap) / 2; // to center the nodes
        let outputIndex = 0;
        for (let j = 0; j < nodes; j++) {
            let y = startY + j * nodeGap;
            let maxBias = Math.max(...allBiases.map(Math.abs));
            let bias = allBiases[currentBiasIndex];
            currentBiasIndex++;

            //// Check if it's the output layer and set fill color accordingly
            //if (i === nnConfig.hiddenLayers.length + 1 && j < JOINT_COLORS.length) {
            //    p.fill(JOINT_COLORS[j]);
            //} else {
            p.fill(GROUP_COLORS[agent.genome.metadata.agentGroup]); // Default fill color
            //}

            let nodeSize = mapBiasToNodeSize(bias, maxBias);
            p.ellipse(x, y, nodeSize, nodeSize);
            p.stroke(0);
            // Add labels to the side of input and output nodes
            if (labels.length > 0) {
                p.textSize(12);
                if (i === 0) {
                    p.text(labels[j], x - 90, y + 4);
                } else if (i === hiddenLayers + 1) {
                    p.text(labels[j], x + 15, y + 4);
                    if (outputJointSpeed && agent.joints[j]) {
                        p.fill(JOINT_COLORS[j]);
                        let currentSpeed = agent.joints[j].getMotorSpeed();
                        p.text(`Speed: ${currentSpeed.toFixed(4)}`, x + 60, y + 4);
                        outputIndex++;
                    }

                    if (outputJointTorque && agent.joints[j - outputIndex]) {
                        p.fill(JOINT_COLORS[j - outputIndex]);
                        p.text(`Max Torque Cant Be Polled :(`, x + 60, y + 4);
                        outputIndex++;
                    }

                    if (outputBias && agent.biases[j - outputIndex]) {
                        p.fill(JOINT_COLORS[j - outputIndex]);
                        let biasI = agent.biases[j - outputIndex];
                        p.text(`Bias: ${biasI}`, x + 60, y + 4);
                    }

                }
            }
        }
        x += layerGap;
    }
    p.pop();
}

AgentNEAT.prototype.makeDecisionNEAT = function (inputs) {
    return tf.tidy(() => {
        const output = this.brain.predict(tf.tensor([inputs])).dataSync();
        let outputIndex = 0;

        for (let i = 0; i < this.joints.length; i++) {

            if (outputJointSpeed) {
                let adjustment = output[outputIndex] * MAX_ADJUSTMENT * Math.min(1, Math.max(0, (this.agentEnergy / this.startingEnergy)));
                this.joints[i].setMotorSpeed(adjustment);
                outputIndex++;
            }

            if (outputJointTorque) {
                let adjustment = output[outputIndex] * MAX_ADJUSTMENT_TORQUE + 500000;
                this.joints[i].setMaxMotorTorque(adjustment);
                outputIndex++;
            }

            if (outputBias) {
                // Adjusting the bias calculation to map [-1, 1] to [1.001, 1.999]
                let adjustment = ((output[outputIndex] + 1) * 0.499) + 1.001;
                this.biases[i] = adjustment;
                outputIndex++;
            }
        }
    });
};

AgentNEAT.prototype.collectInputsNEAT = function () {
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
        inputs.push((position.y - this.startingY) / MAX_Y);
    }

    let velocity = this.mainBody.getLinearVelocity();
    if (inputsAgentV) {
        // 4. Agent's velocity (x,y) normalized based on assumed max values for now
        inputs.push(velocity.x / MAX_VX);  // You may want to use a different max speed value here
        inputs.push(velocity.y / MAX_VY);  // You may want to use a different max speed value here
    }

    if (inputsScore) {
        // 5. Score normalized based on MAX_SCORE
        let score = this.getScore(false);
        let TScore = parseFloat(score[0]);
        inputs.push(TScore / MAX_SCORE); // I don't think this is actually useful to the agent
    }

    if (inputsOrientation) {
        // 6. Agent's orientation normalized to [-1, 1]
        inputs.push(this.mainBody.getAngle() / Math.PI);
    }

    if (inputsTimeRemaining) {
        // 7. Time remaining normalized to [0, 1]
        inputs.push(displayedTimeLeft / MAX_TIME);
    }

    if (inputsDistanceSensors) {
        // 8. Ray-cast distances to the closest obstacle in a few directions from the agent's body
        const baseDirections = [
            planck.Vec2(1, 0),       // E
            planck.Vec2(1, 1),  // NE
            //planck.Vec2(0, 1),       // N
            //planck.Vec2(-1, 1), // NW
            planck.Vec2(-1, 0),      // W
            //planck.Vec2(-1, -1), // SW
            //planck.Vec2(0, -1),      // S
            planck.Vec2(1, -1)   // SE
        ];

        for (let dir of baseDirections) {
            dir.normalize();
        }

        const MAX_DETECTION_DISTANCE = 250;  // Max distance of detection, will make a mutatable part of genome later

        const agentAngle = this.mainBody.getAngle();

        for (let i = 0; i < baseDirections.length; i++) {
            let baseDir = baseDirections[i];
            // Rotate each direction by the agent's angle
            const rotatedDirX = baseDir.x * Math.cos(agentAngle) - baseDir.y * Math.sin(agentAngle);
            const rotatedDirY = baseDir.x * Math.sin(agentAngle) + baseDir.y * Math.cos(agentAngle);

            const rotatedDir = planck.Vec2(rotatedDirX, rotatedDirY);

            const startPoint = this.position;
            const endPoint = planck.Vec2(startPoint.x + rotatedDir.x * MAX_DETECTION_DISTANCE, startPoint.y + rotatedDir.y * MAX_DETECTION_DISTANCE);
            let detectedDistance = MAX_DETECTION_DISTANCE;  // Default to max distance
            let detected = false;

            world.rayCast(startPoint, endPoint, function (fixture, point, normal, fraction) {
                // Check the category of the fixture
                const category = fixture.getFilterCategoryBits();

                // Process only if the category is GROUND
                if (category === CATEGORY_GROUND) {
                    detectedDistance = fraction * MAX_DETECTION_DISTANCE;
                    detected = true;
                    this.rayCastPoints[i] = { start: startPoint, end: point };
                    return fraction;  // This means we accept this hit and won't search further.
                }

                return -1;  // This means we ignore this fixture and continue the search.
            }.bind(this));

            if (!detected) {
                this.rayCastPoints[i] = { start: startPoint, end: endPoint };
            }

            // Normalize detected distance and push to inputs
            inputs.push(detectedDistance / MAX_DETECTION_DISTANCE);
        }
    }

    return inputs;
};

AgentNEAT.prototype.updateMusclesNEAT = function () {
    let inputs = this.collectInputsNEAT();
    this.makeDecisionNEAT(inputs);
    // this.muscleUpdateCount++;
};

AgentNEAT.prototype.renderNNNEAT = function (p, offsetX, offsetY, frameTracker) {
    renderNeuralNetworkNEAT(p, this, offsetX, offsetY, frameTracker);
};