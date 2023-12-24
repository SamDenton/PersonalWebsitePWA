// Variables specific to NEAT version

let offsetY = 0;
let simulationLengthModified = 0;
let render = true;
let singleUpdateCompleted = false;
let stabilised = false;
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
let wallBodies = [];
let duplicateWalls = [];
let fps = 0;

let stageProperties;

const GROUP_COLORS_NAMES = [
    'Traffic purple', 'Grass green', 'Yellow orange', 'Maize yellow', 'Quartz grey', 'Salmon range', 'Pearl black berry', 'Golden yellow', 'Pearl light grey', 'Red lilac',
    'Violet blue', 'Pure green', 'Light ivory', 'Patina green', 'Traffic yellow', 'Ocean blue', 'Pastel blue', 'Reed green', 'Luminous red', 'Turquoise blue',
    'Red Orange', 'Green', 'Very Dark Gray', 'Charcoal', 'Olive Drab', 'Very Dark Red', 'Blue', 'Magenta', 'Bright Yellow', 'Orange',
    'Teal Green', 'Strong Blue', 'Bright Magenta', 'Yellow', 'Brown', 'Gray', 'Dark Red', 'Cool Gray', 'Golden', 'Deep Red'
];


/* 
Ideas:      
            -I want to have the environment both configurable on startup, and for it to get more challenging over generations
            -I want to save agents, either individuals or populations, to re-use later.  Would be good to have a property tracking agent history, its own top score, what the parameters where when it got that score, etc.
            -I want to evolve the inputs and outputs of the network, from a selection of available
            -Look at different limb types (wheels, single limb, jointed/double limb, wing(?), balance)
            -Further explore options for regularization and pruning.
            -I want to add some togglable graphs that show top score and average score over time, and maybe some other metrics
*/

// Next major change needs to be converting all variables to configurable parameters within with stage or agent properties objects.  I should also directly reference these objects throughout my code rather than making variables out of them.

//SketchNEAT is called once to start the simulation and it then calls draw() repeatedly.
let sketchNEAT = function (p) {

    // Variables for rendering.
    nextBatchFrame = 0;
    fixedTimeStep = (1.0 / stageProperties.simSpeed) * 1000; // 'simulationSpeed' updates per second for physics
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
        p.createCanvas(stageProperties.width, stageProperties.height);
        setupPlanckWorldNEAT();
        lastTime = p.millis();

        for (let i = 0; i < stageProperties.backgroundParticles; i++) {
            particles.push({
                x: Math.random() * p.width,
                y: Math.random() * p.height,
                phase: Math.random() * Math.PI * 2 // phase for sin wave
            });
        }

    };

    p.draw = function () {
        p.background(stageProperties.backgroundRed, stageProperties.backgroundGreen, stageProperties.backgroundBlue);

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
                currentProcess = "Letting Agents Settle";
                console.log("Letting Agents Settle");
                if (areAllAgentsStableNEAT()) {
                    // Initialize updateCountStart and frameCountStart for all agents
                    for (let i = 0; i < agents.length; i++) {
                        updateCountStart[i] = 0;
                        frameCountStart[i] = 0;
                    }
                    singleUpdateCompleted = false;
                    agentIndexStart = 0;
                    simulationStarted = true;
                }
            }

            if (simulationStarted) {
                // If not all agents have been updated x times, update one agent per frame
                if (!stabilised) {

                    if (!singleUpdateCompleted && stageProperties.agentsRequireStablising) {
                        // Update the agent
                        agents[agentIndexStart].updateMusclesNEAT();

                        // Initialize or increment the update count for this agent
                        frameCountStart[agentIndexStart] = (frameCountStart[agentIndexStart] || 0) + 1;

                        // If frameCount for the agent reaches framesPerUpdate, reset it and increment updateCount
                        if (frameCountStart[agentIndexStart] >= stageProperties.framesPerUpdateStart) {
                            frameCountStart[agentIndexStart] = 0;
                            updateCountStart[agentIndexStart] = (updateCountStart[agentIndexStart] || 0) + 1;
                        }

                        // Move to the next agent, and cycle back to the beginning if at the end of the array
                        agentIndexStart = (agentIndexStart + 1) % agents.length;
                    }

                    // Check if we've updated each agent x times
                    if (Object.values(updateCountStart).every(countStart => countStart >= stageProperties.updatesPerAgentStart) || !stageProperties.agentsRequireStablising) {
                        singleUpdateCompleted = true;
                        // All agents have been updated the required number of times, now check for stability
                        if (areAllAgentsStableNEAT() || !stageProperties.agentsRequireStablising) {
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
                        for (let i = currentPhysicsBatch * stageProperties.muscleBatch; i < Math.min((currentPhysicsBatch + 1) * stageProperties.muscleBatch, agents.length); i++) {
                            agents[i].mainBody.setType('dynamic');
                            agents[i].updateMusclesNEAT();

                            if (i == 1) {
                                console.log("updating agent 1's muscles");
                            }
                        }

                        // Move to the next batch
                        currentPhysicsBatch++;

                        // Reset to the start if all batches are processed
                        if (currentPhysicsBatch * stageProperties.muscleBatch >= agents.length) {
                            currentPhysicsBatch = 0;
                            // Wait for muscleUpdateFrames before updating muscles again
                            nextBatchFrame = startingTickCounter + stageProperties.totalMuscleUpdateTime;
                        } else {
                            // Wait for batchDelay frames before moving to the next batch
                            nextBatchFrame = startingTickCounter + stageProperties.muscleDelay;
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
                world.step(1 / 60 * stageProperties.physicsGranularityMultipliers, stageProperties.velocityIteration, stageProperties.positionIteration);
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

        // calculateFPSNEAT(p);
        // Render the FPS, Gen No, and Time Left
        p.fill(255);  // Black color for the text
        p.textSize(18);  // Font size
        p.text(`FPS: ${fps}`, 10, 20);
        p.text(`Batch Within Generation: ${runCount} of ${stageProperties.totalNumAgentsMultiplier}`, 10, 50);
        p.text(`Generation: ${stageProperties.genCount}`, 10, 80);
        p.text(`Time Left: ${displayedTimeLeft.toFixed(0)} seconds`, 10, 110);
        p.text(`Top Score: ${stageProperties.topScoreEver.toFixed(2)}`, 10, 140);

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

            if (stageProperties.agentInCentre == "leader") {
                offsetX = p.width / 6 - leadingAgent.position.x + leadingAgent.startingX;  // Center the leading agent on the canvas, just to the left
                offsetY = p.height * 4 / 6 - leadingAgent.position.y + leadingAgent.startingY;
                if (stageProperties.showRays) {
                    let agentOffsetX = offsetX - leadingAgent.startingX;
                    let agentOffsetY = offsetY - leadingAgent.startingY;
                    leadingAgent.renderRayCasts(p, agentOffsetX, agentOffsetY);
                }
            } else if (stageProperties.agentInCentre == "trailer") {
                offsetX = p.width / 6 - trailingAgent.position.x + trailingAgent.startingX;
                offsetY = p.width * 4 / 6 - trailingAgent.position.y + trailingAgent.startingY - 500;
                if (stageProperties.showRays) {
                    let agentOffsetX = offsetX - trailingAgent.startingX;
                    let agentOffsetY = offsetY - trailingAgent.startingY;
                    trailingAgent.renderRayCasts(p, agentOffsetX, agentOffsetY);
                }
            } else if (stageProperties.agentInCentre == "average") {

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

            if (stageProperties.showGroupTrailers == true) {
                agentsToRender.add(trailingAgent);
            }
            if (stageProperties.showGroupLeaders == true) {
                agentsToRender.add(leadingAgent);
            }

            let currentTime = p.millis();

            if (currentTime - lastUIUpdateTime > stageProperties.uiRefreshRate && simulationStarted) {

                fps = p.frameRate().toFixed(0);

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

                displayedTimeLeft = (simulationLengthModified - tickCount) * (1 / stageProperties.simSpeed);

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
                p.text(`Top Scoring Agent: ${topScoreAgentScore} (X Score: ${topScoreAgentXScore} + Y Score: ${topScoreAgentYScore} + Joint Movement Bonus: ${topScoreAgentMovementScore} + Exploration Bonus: ${topScoreAgentExplorationReward} + Size Bonus: ${topScoreAgentSizeReward})  Remaining Energy: ${topScoreAgentEnergy}`, 10, stageProperties.groundY + 30);  // Displaying the score just below the ground

                p.fill(GROUP_COLORS[leadingAgent.genome.metadata.agentGroup]);
                p.text(`Leading Agent Score: ${leadingAgentScore} (X Score: ${leadingAgentXScore} + Y Score: ${leadingAgentYScore} + Joint Movement Bonus: ${leadingAgentMovementScore} + Exploration Bonus: ${leadingAgentExplorationReward} + Size Bonus: ${leadingAgentSizeReward}) Remaining Energy: ${leadingAgentEnergy}`, 10, stageProperties.groundY + 50);

                p.fill(GROUP_COLORS[trailingAgent.genome.metadata.agentGroup]);
                p.text(`Trailing Agent Score: ${trailingAgentScore} (X Score: ${trailingAgentXScore} + Y Score: ${trailingAgentYScore} + Joint Movement Bonus: ${trailingAgentMovementScore} + Exploration Bonus: ${trailingAgentExplorationReward} + Size Bonus: ${trailingAgentSizeReward}) Remaining Energy: ${trailingAgentEnergy}`, 10, stageProperties.groundY + 70);
                p.pop();
            }

            if (stageProperties.showNN == true && simulationStarted) {
                p.push();
                if (stageProperties.agentInCentre == "trailer") {
                    p.text(`Showing Trailing Agents Brain`, 370, 20);
                    // Render NN for leading agent
                    p.fill(GROUP_COLORS[trailingAgent.genome.metadata.agentGroup]);
                    trailingAgent.renderNNNEAT(p, stageProperties.width - 1000, (stageProperties.height / 2) - 40, tickCount);
                } else {
                    p.text(`Showing Leading Agents Brain`, 370, 20);
                    // Render NN for leading agent
                    p.fill(GROUP_COLORS[leadingAgent.genome.metadata.agentGroup]);
                    leadingAgent.renderNNNEAT(p, stageProperties.width - 1000, (stageProperties.height / 2) - 40, tickCount);
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
        p.text(`Fast-Forwarding Generation: ${stageProperties.genCount}`, 10, 20);
    };
};

function areAllAgentsStableNEAT(agentsToCheck = agents) {

    // If agentsToCheck is not an array, make it an array.  Allows this function to be called with a single agent as an argument. Might use for energy recovery or similar
    if (!Array.isArray(agentsToCheck)) {
        agentsToCheck = [agentsToCheck];
    }

    // Define small thresholds for stability
    const linearStabilityThresholdBody = stageProperties.linearStabilityThresholdBody; 
    const angularStabilityThresholdBody = stageProperties.angularStabilityThresholdBody;
    const angularStabilityThresholdLimb = stageProperties.angularStabilityThresholdLimb;
    const stabilityFrames = stageProperties.stabilityFrames; // 50  // Number of frames to wait before confirming stability

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

    const N = stageProperties.swimForceOverNFrames;
    const forceScalingFactor = stageProperties.swimStrength;

    for (let i = 0; i < agent.bodyParts.length; i++) {
        let angle = agent.bodyParts[i].startingAngle;
        let joint = agent.joints[i];
        let currentAngle = joint.getJointAngle();
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
                ? stageProperties.swimBias
                : agent.biases[i];

            let bias = calculateBias(agentFacingDirection, forceDirection, defaultBias);

            let forceMagnitude;

            forceMagnitude = deltaTheta * forceScalingFactor * bias * (agent.limbMass[i] / stageProperties.limbMassForceDivider) * (agent.bodyParts[i].length / stageProperties.limbLengthForceDivider) * agent.bodyParts[i].numberInChain * Math.min(1, Math.max(0, (agent.agentEnergy / agent.startingEnergy)));

            if (agent.agentEnergy > 0 && agent.startingEnergy > 1) {
                agent.agentEnergy -= (Math.abs(forceMagnitude / stageProperties.forceMagnitudeEnergyReductionDivider) * stageProperties.energyUseForceSizeMult) * ((agent.limbMass[i] / stageProperties.limbMassEnergyReductionDivider) * stageProperties.energyUseLimbSizeMult) * ((agent.brainSize / stageProperties.brainSizeEnergyReductionDivider) * stageProperties.energyUseBrainSizeMult);
            }


            // Calculate the force vector
            let force = planck.Vec2(Math.cos(forceDirection) * forceMagnitude, Math.sin(forceDirection) * forceMagnitude);

            // Calculate the point on the limb to apply the force
            let forceApplyPointX = agent.limbs[i].getPosition().x + Math.cos(angle) * (agent.bodyParts[i].length / 1);
            let forceApplyPointY = agent.limbs[i].getPosition().y + Math.sin(angle) * (agent.bodyParts[i].length / 1);

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
    const baseDragCoefficient = stageProperties.liquidViscosity; // Fixed drag for main body
    const minDragCoefficient = stageProperties.minDragCoefficient;
    const maxDragCoefficient = stageProperties.maxDragCoefficient;
    const averageLimbMass = stageProperties.averageLimbMass; // Average limb mass
    const averageLimbLength = stageProperties.averageLimbLength; // Average limb length
    const massScaleFactor = stageProperties.massScaleForDrag; 
    const lengthScaleFactor = stageProperties.lengthScaleForDrag;

    // Apply fixed drag to the main body's linear and angular velocities
    let bodyVelocity = agent.mainBody.getLinearVelocity();
    agent.mainBody.setLinearVelocity(bodyVelocity.mul(baseDragCoefficient ** stageProperties.bodyLinearDragPower));
    let bodyAngularVelocity = agent.mainBody.getAngularVelocity();
    agent.mainBody.setAngularVelocity(bodyAngularVelocity * baseDragCoefficient ** stageProperties.bodyAngularDragPower);

    // Apply varying drag to each limb based on its mass and length
    for (let i = 0; i < agent.bodyParts.length; i++) {
        let limbMass = agent.limbMass[i];
        let limbLength = agent.bodyParts[i].length;

        // Calculate drag coefficient modifiers based on mass and length
        let massModifier = 1 + (limbMass - averageLimbMass) * massScaleFactor;
        let lengthModifier = 1 + (averageLimbLength - limbLength) * lengthScaleFactor;
        let dragCoefficient = baseDragCoefficient * massModifier * lengthModifier;
        // let dragCoefficient = baseDragCoefficient ** (1 / (massModifier + lengthModifier));

        // Clamp the drag coefficient within the specified range
        dragCoefficient = Math.min(Math.max(dragCoefficient, minDragCoefficient), maxDragCoefficient);

        // Apply linear velocity drag
        let limbVelocity = agent.limbs[i].getLinearVelocity();
        agent.limbs[i].setLinearVelocity(limbVelocity.mul(dragCoefficient ** stageProperties.limbLinearDragPower));

        // Apply angular velocity drag
        let limbAngularVelocity = agent.limbs[i].getAngularVelocity();
        agent.limbs[i].setAngularVelocity(limbAngularVelocity * dragCoefficient ** stageProperties.limbAngularDragPower);
    }
}



function applyJointDamping(agent) {
    const maxTorqueForDamping = stageProperties.maxTorqueForDamping;
    const threshold = stageProperties.threasholdAngleForDamping;

    // Damping on approaching joint limits
    for (let i = 0; i < agent.bodyParts.length; i++) {
        let currentAngle = agent.joints[i].getJointAngle();
        let angleDifferenceFromUpperLimit = agent.bodyParts[i].constraints.maxAngle - currentAngle;
        let angleDifferenceFromLowerLimit = currentAngle - agent.bodyParts[i].constraints.minAngle;


        if (angleDifferenceFromUpperLimit < threshold) {
            let normalizedDifferenceUpper = angleDifferenceFromUpperLimit / threshold;
            let torqueAmountUpper = maxTorqueForDamping * (1 - normalizedDifferenceUpper); 
            agent.joints[i].getBodyB().applyTorque(torqueAmountUpper); // Assuming BodyB is the limb.
        }

        if (angleDifferenceFromLowerLimit < threshold) {
            let normalizedDifferenceLower = angleDifferenceFromLowerLimit / threshold;
            let torqueAmountLower = -maxTorqueForDamping * (1 - normalizedDifferenceLower); // Negative torque for lower limit.
            agent.joints[i].getBodyB().applyTorque(torqueAmountLower);
        }
    }
}

function initializeSketchBox2DNEAT(StageProperties) {
    stageProperties = StageProperties;

    // canvasWidth = stageProperties.width;
    // canvasHeight = stageProperties.height;
    // groundY = stageProperties.groundY;
    // popSize = stageProperties.numAgents;
    // numAgentsMultiplier = stageProperties.totalNumAgentsMultiplier;
    // GravityStrength = stageProperties.gravity;
    // FrictionStrength = stageProperties.fiction;
    // simulationLength = stageProperties.simulationLength;
    // renderedAgents = stageProperties.renderedAgents;
    // simulationSpeed = stageProperties.simSpeed;
    topPerformerNo = stageProperties.topPerformerNumber / 100;
    // delay = stageProperties.delay;
    // BATCH_SIZE = stageProperties.batchSize;
    // showNeuralNetwork = stageProperties.showNN;
    // agentToFix = stageProperties.agentInCentre;
    // TOURNAMENT_SIZE = stageProperties.tournamentSize;
    // CROSS_GROUP_PROBABILITY = stageProperties.migrationRate;
    // MIN_GROUP_SIZE = stageProperties.minPopGroupSize;
    // MAX_GROUP_SIZE = stageProperties.maxPopGroupSize;
    // UIUpdateInterval = stageProperties.uiRefreshRate;
    // SOME_DELAY_FRAME_COUNT = stageProperties.muscleDelay;
    // MUSCLE_BATCH_SIZE = stageProperties.muscleBatch;
    // muscleUpdateFrames = stageProperties.totalMuscleUpdateTime;
    // velocityIterations = stageProperties.velocityIteration;
    // positionIterations = stageProperties.positionIteration;
    // physicsGranularityMultiplier = stageProperties.physicsGranularityMultipliers;
    // liquidViscosityDecay = stageProperties.liquidViscosity;
    // increaseTimePerGen = stageProperties.timeIncrease;
    // mapNo = stageProperties.map;
    // randomMapSelector = stageProperties.randomMap;
    // maxSimulationLengthCount = stageProperties.maxSimulationLength;
    // simulationLengthIncreaseCount = stageProperties.simulationLengthIncrease;
    // requireStablising = stageProperties.agentsRequireStablising;
    // MAX_ADJUSTMENT_TORQUE = stageProperties.maxTorqueMultiplier;
    // showRayCasts = stageProperties.showRayCasts;
    // updatesPerAgentStart = stageProperties.updatesPerAgentStart;
    // framesPerUpdateStart = stageProperties.framesPerUpdateStart;
    // topScoreEver = stageProperties.topScoreEver;

    simulationLengthModified = stageProperties.simulationLength;


    frameCountSinceLastFPS = 0;
    lastFPSCalculationTime = 0;
    tickCount = 0;
    displayedTimeLeft = 0;
    offsetY = 0;
    singleUpdateCompleted = false;
    updateCountStart = {};
    frameCountStart = {};
    agentIndexStart = 0;
    leadingAgents = [];
    randomlySelectedAgents = [];
    currentAgentIndex = 0;
    offsetX = 0;
    displayedFPS = 0;
    lastUIUpdateTime = 0;
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

function logGenomes() {
    // Function to log the genomes of all agents
    let agentsToLog = agents;
    agentsToLog.sort((a, b) => parseFloat(b.genome.metadata.agentIndex) - parseFloat(a.genome.metadata.agentIndex))[0];
    console.log("Current agents Array Sorted by Index: ", agentsToLog);

    let tempAgentsToLog = tempAgentPool;
    tempAgentsToLog.sort((a, b) => parseFloat(b.genome.metadata.agentIndex) - parseFloat(a.genome.metadata.agentIndex))[0];
    console.log("tempAgentPool Array Sorted by Index: ", tempAgentsToLog);

    let newGenomes = tempAgentGenomePool;
    newGenomes.sort((a, b) => parseFloat(b.metadata.agentIndex) - parseFloat(a.metadata.agentIndex))[0];
    console.log("tempAgentGenomePool: ", newGenomes);

    let genomes = agentGenomePool;
    genomes.sort((a, b) => parseFloat(b.metadata.agentIndex) - parseFloat(a.metadata.agentIndex))[0];
    console.log("agentGenomePool: ", genomes);
}

function retrieveGenomes() {
    stageProperties.simulationLength = simulationLengthModified;
    const data = {
        genomes: agentGenomePool,
        stageProperties: stageProperties
    };
    const jsonString = JSON.stringify(data);
    saveToFile(jsonString, 'evolvedPopulation.json');
}

function saveSettings(settingsToSave) {
    const data = {
        settings: settingsToSave
    };
    const jsonString = JSON.stringify(data);
    saveToFile(jsonString, 'settings.json');
}

function saveToFile(data, filename) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

function uploadSettings() { // Function to upload settings from a JSON file
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json'; // Accept only JSON files

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) {
                reject('No file selected');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    let uploadedSettings = data.settings;

                    resolve(uploadedSettings); // Resolve the Promise with the uploaded stage properties
                } catch (err) {
                    console.error('Error parsing uploaded file:', err);
                    reject(err);
                }
            };
            reader.readAsText(file);
        };

        input.click(); // Open the file dialog
    });
}

function uploadGenomes() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json'; // Accept only JSON files

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) {
                reject('No file selected');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    let uploadedAgentGenomePool = data.genomes;
                    let uploadedstageProperties = data.stageProperties;

                    // Initialize or update your simulation with the new data
                    initializeSketchBox2DNEAT(uploadedstageProperties);
                    initializeAgentsBox2DNEAT(uploadedAgentGenomePool);

                    resolve(uploadedstageProperties); // Resolve the Promise with the uploaded stage properties
                } catch (err) {
                    console.error('Error parsing uploaded file:', err);
                    reject(err);
                }
            };
            reader.readAsText(file);
        };

        input.click(); // Open the file dialog
    });
}

function skipGen(skipNo) {
    // Function to skip a number of generations by disabling the rendering flag and speeding up physics ticks.  Make use of the 'render' flag, the genCount, which increments automatically every generation, and the simulationSpeed which can be set to 480.  Make use of recursive function to check if genCount has increased by skipNo since the function was called.  We do not need to increment genCount, it already counts generations as they pass
    if (skipNo > 0) {
        stageProperties.simSpeed = 480;
        fixedTimeStep = (1.0 / stageProperties.simSpeed) * 1000;
        render = false;
        let currentGen = stageProperties.genCount;
        let skipGenRecursive = function () {
            if (stageProperties.genCount < currentGen + skipNo) {
                setTimeout(skipGenRecursive, 100);
            } else {
                stageProperties.simSpeed = 60;
                fixedTimeStep = (1.0 / stageProperties.simSpeed) * 1000;
                render = true;
            }
        };
        skipGenRecursive();
    }
}

function updateSimulationNEAT(StageProperties) {
    //simulationLength = stageProperties.simulationLength;
    //renderedAgents = stageProperties.renderedAgents;
    //simulationSpeed = stageProperties.simSpeed;
    //topPerformerNo = stageProperties.topPerformerNumber / 100;
    //delay = stageProperties.delay;
    //BATCH_SIZE = stageProperties.batchSize;
    //showNeuralNetwork = stageProperties.showNN;
    //agentToFix = stageProperties.agentInCentre;
    //TOURNAMENT_SIZE = stageProperties.tournamentSize;
    //CROSS_GROUP_PROBABILITY = stageProperties.migrationRate;
    //MIN_GROUP_SIZE = stageProperties.minPopGroupSize;
    //MAX_GROUP_SIZE = stageProperties.maxPopGroupSize;
    //UIUpdateInterval = stageProperties.uiRefreshRate;
    //SOME_DELAY_FRAME_COUNT = stageProperties.muscleDelay;
    //MUSCLE_BATCH_SIZE = stageProperties.muscleBatch;
    //muscleUpdateFrames = stageProperties.totalMuscleUpdateTime;
    //velocityIterations = stageProperties.velocityIteration;
    //positionIterations = stageProperties.positionIteration;
    //physicsGranularityMultiplier = stageProperties.physicsGranularityMultipliers;

    // Update values in stageProperties
    stageProperties = StageProperties;
}

function initializeAgentsBox2DNEAT(totalPopulationGenomes) {

    // limbsPerAgent = stageProperties.numLimbs; // To be replaced
    // torque = stageProperties.musculeTorque; // To be replaced
    // MAX_ADJUSTMENT = stageProperties.maxJointSpeed;  // To be replaced
    // jointMaxMove = stageProperties.maxJointMoveDivider;  // To be replaced
    // brainDecay = stageProperties.brainDecayOverTime;
    // inputsJointAngle = stageProperties.inputJointAngle;  // To be replaced
    // inputsJointSpeed = stageProperties.inputJointSpeed;  // To be replaced
    // inputsAgentPos = stageProperties.inputAgentPos;  // To be replaced
    // inputsAgentV = stageProperties.inputAgentV;  // To be replaced
    // inputsScore = stageProperties.inputScore;  // To be replaced
    // inputsOrientation = stageProperties.inputOrientation;  // To be replaced
    // inputsTimeRemaining = stageProperties.inputTimeRemaining;  // To be replaced
    // inputsGroundSensors = stageProperties.inputGroundSensors;  // To be replaced
    // inputsDistanceSensors = stageProperties.inputDistanceSensors;  // To be replaced
    // agentMutationRate = stageProperties.offspringMutationRate; 
    // outputJointSpeed = stageProperties.outputsJointSpeed;
    // outputJointTorque = stageProperties.outputsJointTorque;
    // outputBias = stageProperties.outputsBias;
    // swimStrengthMultiplier = stageProperties.swimStrength;
    // swimBiasMultiplier = stageProperties.swimBias; 
    // xScoreMult = stageProperties.xScoreMultiplier;
    // yScoreMult = stageProperties.yScoreMultiplier;
    // movementScoreMult = stageProperties.movementScoreMultiplier;
    // explorationScoreMult = stageProperties.explorationScoreMultiplier;
    // sizeScoreMult = stageProperties.sizeScoreMultiplier;
    // startingEnergyBaseJS = stageProperties.startingEnergyBase;
    // startingEnergyMassPowerJS = stageProperties.startingEnergyMassPower;
    // startingEnergyBodyMassMultJS = stageProperties.startingEnergyBodyMassMult;
    // startingEnergyLimbMassMultJS = stageProperties.startingEnergyLimbMassMult;
    // energyUseForceSizeMultJS = stageProperties.energyUseForceSizeMult;
    // energyUseLimbSizeMultJS = stageProperties.energyUseLimbSizeMult;
    // energyUseBrainSizeMultJS = stageProperties.energyUseBrainSizeMult;
    // genCount = stageProperties.genCount;


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
    if (Array.isArray(populationGenomes) && populationGenomes.length === stageProperties.numAgents) {
        for (let i = 0; i < stageProperties.numAgents; i += stageProperties.batchSize) {
            initializeAgentBatchNEAT(i, Math.min(i + stageProperties.batchSize, stageProperties.numAgents), populationGenomes);
        }
    } else {
        console.log("Issue with population genomes");
    }

    waitForFirstInitializationCompletionNEAT(populationGenomes, totalPopulationGenomes);

    displayedTimeLeft = (stageProperties.simulationLength - tickCount) * (1 / stageProperties.simSpeed);
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

        if (agents.length >= stageProperties.numAgents ) {
            isInitializationComplete = true;
        }
    }, i * stageProperties.delay);
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
            for (let i = 0; i < stageProperties.renderedAgents; i++) {
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

    updateLimbIDs(this.genome);

    this.bodyParts = flattenLimbStructure(this.genome.mainBody.arms);

    // this.numSegments = this.genome.mainBody.bodySegments.length;
    // this.bodySegmentGenes = this.genome.mainBody.bodySegments;

    this.numLimbs = this.bodyParts.length;  // + other limb types

    this.numBodyParts = this.numLimbs + this.numSegments + 1; // inc 1 for the main body


    this.index = this.genome.metadata.agentIndex;
    let mainBodyRadius = this.genome.mainBody.size;
    // const locationBatchSize = 10;
    this.startingX = stageProperties.agentStartX + (Math.floor(this.genome.metadata.runGroup) * stageProperties.agentStartSpawnGap);
    this.startingY = stageProperties.agentStartY;
    this.limbBuffer = Array(this.numLimbs).fill().map(() => []);
    let mainBodyDensity = this.genome.mainBody.density;
    this.mainBody = createMainBodyNEAT(world, this.startingX, this.startingY, mainBodyRadius, mainBodyDensity);
    this.position = this.mainBody.getPosition();
    this.rayCastPoints = [];

    this.Score = 0;
    this.internalMap = [];
    this.coveredCellCount = 0;
    const internalMapSize = stageProperties.internalMapSize;
    const internalMapCellSize = stageProperties.internalMapCellSize;
    if (stageProperties.explorationScoreMultiplier > 0) {
        for (let i = 0; i < internalMapSize; i++) {
            let row = [];
            for (let n = 0; n < internalMapSize; n++) {
                row.push(false);
            }
            this.internalMap.push(row);
        }
    }

    // this.bodySegments = [];
    // this.bodySegmentsbMass = [];
    // this.wings = [];
    // this.thrusters = [];
    this.limbs = [];
    this.limbMass = [];
    this.joints = [];
    this.biases = [];

    for (let i = 0; i < this.limbs; i++) {
        this.biases.push(1.5);
    }

    // Brain size is used to calculate how much energy the agent uses for movement, bigger brains use more energy.  Could include weight sum too
    this.brainSize = this.genome.inputLayerGenes[0].numberOfNeurons + this.genome.outputLayerGenes[0].numberOfNeurons;
    for (let i = 0; i < this.genome.layerGenes.length; i++) {
        this.brainSize += this.genome.layerGenes[i].numberOfNeurons;
    }

    // console.log(this.bodyParts);
    for (let part of this.bodyParts) {
        let parentLimb;this.arms
        let parentLimbLength = 0;
        let parentLimbGenome;

        try { 
            if (part.numberInChain === 1) {
                parentLimb = this.mainBody;
                parentLimbLength = mainBodyRadius;
            } else if (part.numberInChain > 1 && part.parentLimbID != 0) {
                parentLimb = this.limbs.find(limb => limb.getUserData() === part.parentPartID);
                parentLimbGenome = this.bodyParts.find(limb => limb.partID === part.parentPartID);
                parentLimbLength = parentLimbGenome.length;
            } else {
                console.log("Error in arm initialization, number in chain does not match.  Genome: " + JSON.stringify(this.genome));
            }
        } catch (err) {
            console.log("Error in arm initialization, number in chain does not match.  Genome: " + JSON.stringify(this.genome));
        }

        // if (part.type == "BodySegment") {
        //      body segment constructor
        //      this.bodySegments.push(bodySegment);
        //      this.bodySegmentsbMass.push(bodySegment.getMass());
        // else 
        if (part.type == "Arm") {
            const angle = part.startingAngle;
            // Calculate the position of the limb's center
            let offsetFromMainLimb;
            if (part.numberInChain === 1) {
                // Parent limb is main body
                offsetFromMainLimb = mainBodyRadius + part.length / 2;
                part.attachment = { x: mainBodyRadius * Math.cos(angle), y: -mainBodyRadius * Math.sin(angle) };
                part.limbX = this.startingX + offsetFromMainLimb * Math.cos(angle);
                part.limbY = this.startingY - offsetFromMainLimb * Math.sin(angle);
            } else if (part.numberInChain > 1) {
                // Parent limb is another limb
                offsetFromMainLimb = parentLimbLength / 2 + part.length / 2;
                part.attachment = { x: 0, y: parentLimbLength / 2 };
                part.limbX = parentLimbGenome.limbX + offsetFromMainLimb * Math.cos(angle);
                part.limbY = parentLimbGenome.limbY - offsetFromMainLimb * Math.sin(angle);
            } 

            let arm = createLimbNEAT(world, part.limbX, part.limbY, part.length, part.width, angle, part.partID);

            let localAnchorA;
            localAnchorA = planck.Vec2(
                part.attachment.x,
                part.attachment.y
            );
            
            // Calculate the point after rotation
            let localAnchorB = planck.Vec2(0, -part.length / 2);

            let joint = createRevoluteJointNEAT(world, parentLimb, arm, localAnchorA, localAnchorB, part.constraints.minAngle, part.constraints.maxAngle, part.constraints.maxTorque);
            this.joints.push(joint);

            // body segment constructor
            this.limbs.push(arm);
            this.limbMass.push(arm.getMass());
        }
        // else if (part.type == "Wing") {
        //      body segment constructor
        //      this.wings.push(wing);
        //      this.limbs.push(wing);
        //      this.limbMass.push(wing.getMass());
        // else if (part.type == "Thruster") {
        // ... other constructors

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
    } else {
        this.brain = createNeuralNetworkNEAT(this.genome);
    }

    // Score and energy stuff
    this.limbMassTot = 0;

    if (this.limbMassTot < 10) {
        for (let i = 0; i < this.limbs.length; i++) {
            this.limbMassTot += this.limbs[i].getMass();
        }
    }

    if (stageProperties.startingEnergyBodyMassMult > 0) {
        this.startingEnergy = stageProperties.startingEnergyBase + (((this.mainBody.getMass() / stageProperties.bodyStartingMassEnergyReductionDivider * stageProperties.startingEnergyBodyMassMult) + (this.limbMassTot / stageProperties.limbStartingMassEnergyReductionDivider * stageProperties.startingEnergyLimbMassMult)) * (stageProperties.simulationLength / 2000)) ** stageProperties.startingEnergyMassPower; // + body segments mass and maybe limbs later
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
                let change = Math.abs(currentAngle - this.previousJointAngles[i]) * (this.limbs[i].getMass() / stageProperties.jointMovementRewardLimbMassDivider);
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
        let gridX = Math.floor(((this.position.x - this.startingX) + 10) / internalMapCellSize) + 5;  // Start in cell 5,5 slightly offset from the origin so they can explore backwards.  The +10 is to account for the agent spawning on the boundary of a grid, so getting 4 cells explored instantly
        let gridY = Math.floor(((this.startingY - this.position.y) + 10) / internalMapCellSize) + 5;  // Subtracting due to flipped Y-axis

        if (gridX >= 0 && gridX < internalMapSize && gridY >= 0 && gridY < internalMapSize) {
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
        let XPosScore = Math.floor(this.furthestXPos - this.startingX) * stageProperties.xScoreMultiplier;
        let YPosScore = Math.floor(this.startingY - this.furthestYPos) * stageProperties.yScoreMultiplier;

        let jointMovementReward = 0;
        if (stageProperties.movementScoreMultiplier > 0) {
            jointMovementReward = (this.getJointMovementReward() * 15 / this.numLimbs) * stageProperties.movementScoreMultiplier; // Adjust multiplier if needed
        }

        let explorationReward = 0;

        if (stageProperties.explorationScoreMultiplier > 0) {
            explorationReward = this.getExplorationReward() * stageProperties.explorationScoreMultiplier;
        }

        let weightPenalty;
        //if (roundOver) {
        //    weightPenalty = this.getWeightPenalty() * 50;
        //} else {
            weightPenalty = 0;
        //}

        if (!roundOver && this.massBonus < 10 && stageProperties.sizeScoreMultiplier > 0) {
            try {
                this.massBonus = this.mainBody.getMass() * stageProperties.sizeScoreMultiplier;
                // loop through limbs and add their mass to the massBonus
                for (let i = 0; i < this.limbs.length; i++) {
                    this.massBonus += this.limbs[i].getMass() * (stageProperties.sizeScoreMultiplier);
                }
            } catch (e) {
                this.massBonus = 0;
            }
        }

        if (stageProperties.massBonusIsDynamic === true) {
            this.massBonusMultiplier = (this.massBonus / stageProperties.dynamicMassBonusDivider) * (XPosScore + YPosScore); // This makes the mass bonus scale with the distance traveled, so static, large agents don't get a huge advantage
        } else {
            this.massBonusMultiplier = this.massBonus; // This makes the mass bonus static, so large agents get a huge advantage
        }

        this.Score = XPosScore + YPosScore + jointMovementReward + explorationReward - weightPenalty + this.massBonusMultiplier;

        if (this.Score < 1) {
            this.Score = 1;
        }

        if (this.Score > stageProperties.topScoreEver) {
            stageProperties.topScoreEver = this.Score;
        }

        // I will also give score bonus for how unique an agent is, both brain and body.
        // This will mean a function to calculate the average values for things like the brain shape, number of limbs, depth of limb chains, etc.

        return [
            parseFloat(this.Score.toFixed(2)),
            parseFloat(XPosScore.toFixed(2)),
            parseFloat(YPosScore.toFixed(2)),
            parseFloat(weightPenalty.toFixed(2)),
            parseFloat(jointMovementReward.toFixed(2)),
            parseFloat(explorationReward.toFixed(2)),
            parseFloat(this.massBonusMultiplier.toFixed(2)),
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
        for (let i = 0; i < this.limbs.length; i++) {
            let limb = this.limbs[i];
            if (limb) {
                let limbPos = limb.getPosition();
                let limbAngle = limb.getAngle();
                let genomeLimb = this.bodyParts.find(limbToFind => limbToFind.partID === limb.getUserData());

                p.push();
                p.translate(limbPos.x + offsetX, limbPos.y + offsetY);
                p.rotate(limbAngle);
                p.rect(-genomeLimb.width / 2, -genomeLimb.length / 2, genomeLimb.width, genomeLimb.length); // Using width and length from genome
                p.pop();
            }
        }

        // Render the joints
        for (let i = 0; i < this.limbs.length; i++) {
            if (this.joints[i]) {
                let jointPos = this.joints[i].getAnchorA();
                p.push();
                // Check if the current joint's index is within the jointColors array length
                if (i < GROUP_COLORS.length) {
                    p.fill(GROUP_COLORS[i]);  // Set the fill color to the corresponding color from the jointColors array
                } else {
                    p.fill(0, 255, 0);  // Default fill color if there isn't a corresponding color in the array
                }
                p.ellipse(jointPos.x + offsetX, jointPos.y + offsetY, 7, 7);  // Added offsetX
                p.pop();
            }
        }

        // Render second set of joint anchors for testing
        //for (let i = 0; i < this.limbs.length; i++) {
        //    if (this.joints[i]) {
        //        p.push();
        //        let jointPos = this.joints[i].getAnchorB();
        //        // Check if the current joint's index is within the jointColors array length
        //        p.fill(0, 255, 0); 
        //        p.ellipse(jointPos.x + offsetX, jointPos.y + offsetY, 3, 3);  // Added offsetX
        //        p.pop();
        //    }
        //}
        // Draw a small circle at the center of the agent (200, 600)
        //p.push();
        //p.fill(0);
        //p.ellipse(this.startingX + offsetX, this.startingY + offsetY, 10, 10);
        //p.pop();
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

function createLimbNEAT(world, x, y, length, width, angle, limbNo) {
    // Check if length is greater than width and adjust angle accordingly
    // Should maybe remove the check and always apply this.  Will see if mutations to proportions still cause floating limbs 
    //if (length > width) {
        angle += Math.PI / 2;
    //}

    let bodyDef = {
        type: 'dynamic',
        position: planck.Vec2(x, y),
        angle: -angle
    };

    let body = world.createBody(bodyDef);
    let shape = planck.Box(width / 2, length / 2);

    let fixtureDef = {
        shape: shape,
        density: 0.1, // Should make this a genome property
        filterCategoryBits: CATEGORY_AGENT_LIMB,
        filterMaskBits: CATEGORY_GROUND,  // Only allow collision with the ground
    };
    body.createFixture(fixtureDef);
    body.setUserData(limbNo); //"Agent " + agentNo + " Limb " + 

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
        randomlySelectedAgents = randomlySelectedAgents.slice(0, numGroups * stageProperties.renderedAgents);

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

        agents[i].genome.agentHistory.lastScore = { score: thisScore, map: randMap, generation: stageProperties.genCount };

        // Store the score only if the generation is a multiple of STORE_EVERY_N_GENERATIONS
        if (stageProperties.genCount % 5 === 0) {
            agents[i].genome.agentHistory.scoreHistory.push({ score: thisScore, map: randMap, generation: stageProperties.genCount });
        }

        agents[i].genome.agentHistory.rankInPop = (i + 1);

        if (thisScore > agents[i].genome.metadata.bestScore) {
            agents[i].genome.metadata.bestScore = thisScore;
        }
    }

    // loop through agents array with a for each and add each agent to tempAgentPool
    agents.forEach(agent => tempAgentPool.push(_.cloneDeep(agent)));

    // Continue to the next generation once the tempAgentPool is full
    if (tempAgentPool.length >= stageProperties.numAgents * stageProperties.totalNumAgentsMultiplier) {
        nextGenerationNEAT(p);
    } else {
        nextAgentgroupNEAT(p);
    }

}

function setupPlanckWorldNEAT() {
    // Create the Planck.js world
    // Could use the gravity property to add a 'current' to the world, rather than creating it with forces manually.  I assume this property is fixed once the world is created though
    const gravity = planck.Vec2(0.0, stageProperties.gravity * 9.8);
    world = planck.World(planck.Vec2(0.0, 0.0));

    // Adds event listener for collisions, console logged. Will need to uncomment UserData setting for each body to use
    //world.on('begin-contact', function (contact) {
    //    let fixtureA = contact.getFixtureA();
    //    let fixtureB = contact.getFixtureB();
    //    let bodyA = fixtureA.getBody();
    //    let bodyB = fixtureB.getBody();

    //    console.log("Collision between:", bodyA.getUserData(), "and", bodyB.getUserData());
    //});

    createMaps(stageProperties.map);
}

function createMaps(mapNumber) {

    // I am going to need to design some new maps that allow larger agent body plans.  Maybe with different routes.  Shorter routes are narrower to give an advantage to small body plans

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

    for (let i = 0; i < Math.ceil(stageProperties.totalNumAgentsMultiplier); i++) {
        const offset = i * stageProperties.agentStartSpawnGap; // Define an appropriate spacing value to separate the sets of walls
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

    //if (stageProperties.framesPerUpdateStart > 1) {
    //    stageProperties.framesPerUpdateStart--;
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
    if (Array.isArray(populationGenomes) && populationGenomes.length === stageProperties.numAgents) {
        for (let i = 0; i < stageProperties.numAgents; i += stageProperties.batchSize) {
            initializeAgentBatchNEAT(i, Math.min(i + stageProperties.batchSize, stageProperties.numAgents), populationGenomes);
        }
    } else {
        console.log("Issue with population genomes");
    }

    waitForInitializationCompletionBatchNEAT();

    console.log('Restarting simulation with next set of agents!');

    // Reset simulation
    // await new Promise(resolve => setTimeout(resolve, 1000));
    displayedTimeLeft = (simulationLengthModified - tickCount) * (1 / stageProperties.simSpeed);
    stabilityCounter = 0;
    tickCount = 0;
    nextBatchFrame = 1;
    currentPhysicsBatch = 0;
    // p.loop();
}

function waitForInitializationCompletionBatchNEAT(populationGenomes) {
    // Check if the condition is met
    if (agents.length >= stageProperties.numAgents) {
        runCount++;
        currentProcess = "Starting next round";

        populationGenomes = [];
        randomlySelectedAgents = [];
        for (let groupId = 0; groupId < numGroups; groupId++) {
            let groupAgentsForRender = agents.filter(agent => agent.genome.metadata.agentGroup === groupId);

            // Select few random agents
            for (let i = 0; i < stageProperties.renderedAgents; i++) {
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
    if (stageProperties.framesPerUpdateStart > 1) {
        stageProperties.framesPerUpdateStart--;
    }
    runCount = 0;
    currentProcess = "Performing Crossover, Mutation, and Selection on total population to create offspring";

    if (stageProperties.randomMap) {
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
        if (stageProperties.genCount % 5 === 0) {
            agents[i].genome.agentHistory.scoreHistory.push({ score: thisScore, map: randMap, generation: stageProperties.genCount });
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
    //for (let i = 0; i < Math.round(topPerformerNo * stageProperties.numAgents); i++) {
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
        let agentsNeeded = Math.floor((stageProperties.totalNumAgentsMultiplier * stageProperties.numAgents) / numGroups);

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
    if (stageProperties.timeIncrease && simulationLengthModified < stageProperties.maxSimulationLength) {
        // simulationLengthModified += simulationLengthModified * 0.005;
        simulationLengthModified += stageProperties.simulationLengthIncrease;
    }

    // Reset simulation
    // await new Promise(resolve => setTimeout(resolve, 1000));
    displayedTimeLeft = (simulationLengthModified - tickCount) * (1 / stageProperties.simSpeed);
    stabilityCounter = 0;
    tickCount = 0;
    nextBatchFrame = 1;
    currentPhysicsBatch = 0;
    stageProperties.genCount++;
    // p.loop();
}

// Recursive function checking if agents have finished loading into world
function waitForInitializationCompletionNEAT() {
    // Check if the condition is met
    if (tempAgentGenomePool.length >= stageProperties.numAgents * stageProperties.totalNumAgentsMultiplier) {

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
            agentGenomePool[i].metadata.runGroup = i % stageProperties.totalNumAgentsMultiplier;
        }

        // let populationGenomes equal a selection of totalPopulationGenomes based on the agentGenomePool[i].metadata.runGroup. Can use the inter generation run counter runCount for the search
        let populationGenomes = agentGenomePool.filter(genome => genome.metadata.runGroup === runCount);

        // Initialize agents in batches
        if (Array.isArray(populationGenomes) && populationGenomes.length === stageProperties.numAgents) {
            for (let i = 0; i < stageProperties.numAgents; i += stageProperties.batchSize) {
                initializeAgentBatchNEAT(i, Math.min(i + stageProperties.batchSize, stageProperties.numAgents), populationGenomes);
            }
        } else {
            console.log("Issue with population genomes");
        }

        waitForFinalInitializationCompletionNEAT();

    } else {
        // If the condition is not met, wait for some time and check again
        setTimeout(() => waitForInitializationCompletionNEAT(), 100);
    }
}

function waitForFinalInitializationCompletionNEAT() {
    // Check if the condition is met
    if (agents.length >= stageProperties.numAgents) {

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
            for (let i = 0; i < stageProperties.renderedAgents; i++) {
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
        setTimeout(() => waitForFinalInitializationCompletionNEAT(), 100);
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

        // Chance to mutate the genome or body plan of top performers
        if (Math.random() > stageProperties.chanceToIncludeTopPerformerInMutation) {
            newAgentGenome = mutateGenome(newAgentGenome, newAgentGenome.hyperparameters.mutationRate, newAgentGenome.hyperparameters.nodeMutationRate, newAgentGenome.hyperparameters.layerMutationRate);
        }

        if (Math.random() < stageProperties.chanceToIncludeTopPerformerInMutation) {
            newAgentGenome = mutateBodyPlan(newAgentGenome, newAgentGenome.hyperparameters.limbMutationRate);
        }

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

    if (Math.random() < stageProperties.chanceToIncludeOffspringInMutation) {
        childGenome = mutateGenome(childGenome, childGenome.hyperparameters.mutationRate, childGenome.hyperparameters.nodeMutationRate, childGenome.hyperparameters.layerMutationRate);
    }
    if (Math.random() < stageProperties.chanceToIncludeOffspringInMutation) {
        childGenome = mutateBodyPlan(childGenome, childGenome.hyperparameters.limbMutationRate);
    }

    // Decay all weights in the brain by a small amount
    if (stageProperties.brainDecayOverTime) {
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
    if (Math.random() < stageProperties.migrationRate) {
        groupAgents = allAgents;
    }

    // Tournament Selection
    let tournamentContestants = [];

    for (let i = 0; i < stageProperties.tournamentSize; i++) {
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
    if (Math.random() < stageProperties.migrationRate) {
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
    childGenome.mainBody.size = Math.random() < 0.5 ? dominantParentGenome.mainBody.size : submissiveParentGenome.mainBody.size;

    // Disabled code to swap randomly between different limbs as its causing issues.  Need to come up with a better way to do this.
    // Could maybe use a similar method to removing limbs, where I flatten the arms array, filter out limbs with no sub limbs, then pick some of those to swap.

    // Check for each limb in the child genome whether to keep it or swap it
    // Currently just checking main limbs not sub limbs, and have added a check to make sure the number of sublimbs is the same in both parents limb to swap.
    //childGenome.mainBody.arms.forEach((limb, idx) => {
    //    // If there's a corresponding limb in both parents, decide whether to swap
    //    // Swap with probability 0.1.
    //    // For now, check that the number of limbs in the child genome is the same as the number of limbs in the submissive parent genome
    //    // I will want to develop a more robust way to swap limbs when the total number differs.  Will just mean adjusting the 'number of neurons' in the input layer.
    //    if (Math.random() < 0.1 && dominantParentGenome.mainBody.arms[idx] && submissiveParentGenome.mainBody.arms[idx] && childGenome.inputLayerGenes.numberOfNeurons == submissiveParentGenome.inputLayerGenes.numberOfNeurons) {
    //        childGenome.mainBody.arms[idx] = _.cloneDeep(submissiveParentGenome.mainBody.arms[idx]);
    //        childGenome.agentHistory.mutations.push("type: limb, mutation: swap from parent: " + submissiveParentGenome.metadata.agentName + " With index: " + idx);
    //    }
    //});

    //updateLimbIDs(childGenome);

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
    const stdDeviation = stageProperties.neuronMutationStandardDeviation;

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
    // Helper function to mutate limb properties
    function mutateLimb(limb) {
        if (Math.random() < bodyMutationRate) {
            limb.constraints.maxTorque = mutateWithinBounds(limb.constraints.maxTorque, 1000, 79000);
        }
        if (Math.random() < bodyMutationRate) {
            limb.constraints.maxAngle = mutateWithinBounds(limb.constraints.maxAngle, Math.PI / 5, Math.PI / 2);
        }
        if (Math.random() < bodyMutationRate) {
            limb.constraints.minAngle = mutateWithinBounds(limb.constraints.minAngle, -(Math.PI / 2), -(Math.PI / 5));
        }
        if (Math.random() < bodyMutationRate) {
            limb.length = mutateWithinBounds(limb.length, 10, 60);
        }
        if (Math.random() < bodyMutationRate) {
            limb.width = mutateWithinBounds(limb.width, 2, 22);
        }
        if (Math.random() < bodyMutationRate) {
            limb.startingAngle = mutateWithinBounds(limb.startingAngle, 0, 2 * Math.PI);
        }

        // Mutate sub-limbs recursively
        limb.subArms.forEach(mutateLimb);
    }

    // Main Body Size Mutation
    if (Math.random() < bodyMutationRate) {
        childGenome.mainBody.size = mutateWithinBounds(childGenome.mainBody.size, 10, 30);
    }
    if (Math.random() < bodyMutationRate) {
        childGenome.mainBody.density = mutateWithinBounds(childGenome.mainBody.density, 0.1, 0.8);
    }

    // Limb Properties Mutation
    childGenome.mainBody.arms.forEach(mutateLimb);

    // Limb Number Mutation, half as often as other body mutations
    // My current setup just randomly decides to add or remove a limb, and randomly decides where.  Closer to evolution would be if I gave each limb a chance to have a number of actions occur, such as growing a new limb, altering its own properties, or removing itself.
    if (Math.random() < bodyMutationRate) { // normally divided by 2 but increase chance for testing
        if (Math.random() < 0.5) {

            let totalLimbs = countArms(childGenome.mainBody.arms);
            let newLimbID = totalLimbs + 1;

            let selectedPart = selectRandomBodyPart(childGenome.mainBody);
            let closestLimb = findClosestLimbForWeights(selectedPart, childGenome.mainBody.arms);

            let angle = Math.random() * 2 * Math.PI; // Random angle for the new limb
            let newLimb = createNewLimb(angle, selectedPart, newLimbID);

            addChildLimbToPart(selectedPart, newLimb);

            let inputNodeIndex;
            if (newLimb.numberInChain == 1) {
                inputNodeIndex = newLimbID;
            } else {
                // Flatten the limb structure and find the index of the selectedPart
                let flattenedLimbs = flattenLimbStructure(childGenome.mainBody.arms, childGenome.mainBody);
                let indexOfSelectedPart = flattenedLimbs.findIndex(part => part.partID === selectedPart.partID);

                // Count all limbs before the selected part
                inputNodeIndex = indexOfSelectedPart + selectedPart.subArms.length;
            }

            updateLimbIDs(childGenome);

            // Add a new node to the input layer for the limb
            let inputLayer = childGenome.inputLayerGenes[0];

            let inputNodeId = generateUniqueId(childGenome.usedBiasIDs);  // Generate a unique ID for this node
            inputLayer.biases.splice(inputNodeIndex, 0, { id: inputNodeId, value: Math.random() }); // Insert at index = limb ID
            inputLayer.numberOfNeurons++;
            childGenome.inputLayerGenes[0].inputs.push(childGenome.inputLayerGenes[0].inputs.length);

            // Add a new node to the output layer for the limb
            let outputLayer = childGenome.outputLayerGenes[0];
            let outputNodeIndex = outputLayer.biases.length; // ID of the node equals its index in the output layer
            let outputNodeID = childGenome.usedBiasIDs.length;
            outputLayer.biases.push({ id: outputNodeID, value: Math.random() });
            outputLayer.numberOfNeurons++;

            // Add new weights associated with the new nodes
            // For the input layer, link weights from the new input node to all nodes in the first hidden layer
            let firstHiddenLayer = childGenome.layerGenes[0];
            let lastHiddenLayer = childGenome.layerGenes[childGenome.layerGenes.length - 1];
            // Use the weights from the closest limb for the new limb, if a closest limb is found
            if (closestLimb) {

                // Assuming weights for limbs are stored in an array-like structure indexed by partID
                let closestLimbInputWeights = firstHiddenLayer.weights[closestLimb.partID];
                let closestLimbOutputWeights = outputLayer.weights.map(weightsArray => weightsArray[closestLimb.partID]);

                firstHiddenLayer.weights.splice(inputNodeIndex, 0, closestLimbInputWeights.map(weight => ({
                    ...weight,
                    fromNodeID: inputNodeId // Use the new unique ID here
                })));

                lastHiddenLayer.biases.forEach((bias, idx) => {
                    outputLayer.weights[idx].splice(outputNodeIndex, 0, {
                        ...closestLimbOutputWeights[idx],
                        toNodeID: outputNodeID
                    });
                });

                childGenome.agentHistory.mutations.push("type: limb, id: " + newLimb.partID + " mutation: add, " + "Copied weights from limb: " + closestLimb.partID + " Number In Chain: " + newLimb.numberInChain);
                // console.log("type: limb, id: " + newLimb.partID + " mutation: add, " + " Copied weights from limb: " + closestLimb.partID);
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
                childGenome.agentHistory.mutations.push("type: limb, id: " + newLimb.partID + " mutation: add" + "Used random weights");
                // console.log("type: limb, id: " + newLimb.partID + " mutation: add" + "Used random weights.");
            }


        } else {
            if (childGenome.mainBody.arms.length > 1) {

                let flattenedLimbs = flattenLimbStructure(childGenome.mainBody.arms);
                let limbsWithoutSubLimbs = flattenedLimbs.filter(limb => !limb.subArms || limb.subArms.length === 0);

                if (limbsWithoutSubLimbs.length > 0) {
                    let limbToRemoveIndex = Math.floor(Math.random() * limbsWithoutSubLimbs.length);
                    let limbToRemove = limbsWithoutSubLimbs[limbToRemoveIndex];

                    // Find the index of limbToRemove in the flattenedLimbs array
                    let flattenedIndex = flattenedLimbs.findIndex(limb => limb.partID === limbToRemove.partID);

                    // Remove limb from genome
                    removeLimbFromGenome(limbToRemove, childGenome);

                    // Update history
                    childGenome.agentHistory.mutations.push(`type: ${limbToRemove.numberInChain === 1 ? 'limb' : 'sublimb'}, id: ${limbToRemove.partID}, index: ${flattenedIndex}, mutation: remove`);

                    updateLimbIDs(childGenome);

                    // Remove node from the input layer
                    childGenome.inputLayerGenes[0].biases.splice(flattenedIndex, 1);
                    childGenome.inputLayerGenes[0].numberOfNeurons--;
                    childGenome.inputLayerGenes[0].inputs.splice(flattenedIndex, 1);

                    // Remove weights connected to the removed input node from the first hidden layer
                    childGenome.layerGenes[0].weights.splice(flattenedIndex, 1);

                    // Remove node from the output layer
                    let outputLayer = childGenome.outputLayerGenes[0];
                    outputLayer.biases.pop();
                    outputLayer.numberOfNeurons--;

                    // Remove weights connected to the removed output node in the last hidden layer
                    let lastHiddenLayer = childGenome.layerGenes[childGenome.layerGenes.length - 1];
                    lastHiddenLayer.weights.forEach(weightArray => {
                        weightArray.pop();
                    });
                }
            }
        }
    }


    return childGenome;
}

function countArms(armsToCount) {
    let totalArmNo = 0;

    if (!armsToCount) return 0;

    for (let arm of armsToCount) {
        totalArmNo++; // Count the current arm
        totalArmNo += countArms(arm.subArms); // Count sub-arms recursively
    }

    return totalArmNo;
}

function selectRandomBodyPart(mainBody) {
    // Flatten the structure of limbs into a single array
    let allParts = flattenLimbStructure(mainBody.arms, mainBody);
    let randomIndex = Math.floor(Math.random() * allParts.length);
    return allParts[randomIndex];
}

function flattenLimbStructure(limbs, parentLimb = null) {
    let parts = parentLimb ? [parentLimb] : [];

    for (let limb of limbs) {
        parts.push(limb);
        if (limb.subArms) {
            // Do not include the parent limb in recursive calls
            parts = parts.concat(flattenLimbStructure(limb.subArms));
        }
    }

    return parts;
}


function findClosestLimbForWeights(selectedPart, allLimbs) {
    if (selectedPart.subArms && selectedPart.subArms.length > 0) {
        return findClosestLimb(selectedPart.subArms, selectedPart.startingAngle, null);
    }
    return findClosestLimb(allLimbs, selectedPart.startingAngle, null);
}

function findClosestLimb(arms, targetAngle, closestLimb) {
    for (let arm of arms) {
        let currentAngleDiff = Math.abs(arm.startingAngle - targetAngle);
        let closestAngleDiff = closestLimb ? Math.abs(closestLimb.startingAngle - targetAngle) : Infinity;

        if (currentAngleDiff < closestAngleDiff) {
            closestLimb = arm;
        }

        if (arm.subArms && arm.subArms.length > 0) {
            closestLimb = findClosestLimb(arm.subArms, targetAngle, closestLimb);
        }
    }
    return closestLimb;
}

function createNewLimb(angle, selectedPart, newLimbID) {
    return {
        partID: newLimbID,
        startingAngle: angle,
        attachment: {
            x: selectedPart.size * Math.cos(angle),
            y: selectedPart.size * Math.sin(angle)
        },
        constraints: {
            maxTorque: Math.random() * 79000,
            maxAngle: Math.PI / (2 + Math.floor(Math.random(4))),
            minAngle: -Math.PI / (2 + Math.floor(Math.random(4)))
        },
        length: 10 + Math.floor(Math.random(50)), // length: 30 + Math.floor(Math.random(20)),
        width: 2 + Math.floor(Math.random(20)), // width: 10 + Math.floor(Math.random(10)),
        shape: "rectangle",
        subArms: [],
        numberInChain: selectedPart.numberInChain + 1,
        parentPartID: selectedPart.partID,
        type: "Arm",
    };
}

function addChildLimbToPart(selectedPart, newLimb) {
    if (selectedPart.type === 'MainBody' || !selectedPart.subArms) {
        selectedPart.arms.push(newLimb);
    } else {
        selectedPart.subArms.push(newLimb);
    }
}

// Helper function to remove a limb from the genome
function removeLimbFromGenome(limbToRemove, childGenome) {
    function recursiveRemove(limbs, limbID) {
        for (let i = 0; i < limbs.length; i++) {
            if (limbs[i].partID === limbID) {
                limbs.splice(i, 1);
                return true;
            }
            if (limbs[i].subArms && recursiveRemove(limbs[i].subArms, limbID)) {
                return true;
            }
        }
        return false;
    }

    recursiveRemove(childGenome.mainBody.arms, limbToRemove.partID);
}

function updateLimbIDs(genome) {
    // Flatten the limb structure to easily update IDs
    let flattenedLimbs = flattenLimbStructure(genome.mainBody.arms);

    // Update the partID for each limb based on its position in the flattened array
    for (let i = 0; i < flattenedLimbs.length; i++) {
        let currentLimb = flattenedLimbs[i];
        currentLimb.partID = i + 1;  // +1 because main body is limb 0

        for (let subLimb of currentLimb.subArms) {
            subLimb.parentPartID = currentLimb.partID;
        }
    }
}

function mutateWithinBounds(original, min, max) {

    const stdDeviation = stageProperties.bodyPlanMutationStandardDeviation;
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
    const layerGap = stageProperties.renderedNNLayerGap; // horizontal space between layers
    const nodeGap = stageProperties.renderedNNNodeGap;   // vertical space between nodes
    let outputLabels = [];
    let allWeightTensors;
    let allWeights;
    let allBiasesTensors;
    let allBiases;
    p.push();
    p.fill(GROUP_COLORS[agent.genome.metadata.agentGroup]);

    let inputLabels = [];

    if (stageProperties.inputJointAngle) {
        inputLabels = inputLabels.concat(Array(agent.joints.length).fill(null).map((_, idx) => `Joint Angle ${idx + 1}`));
    }

    if (stageProperties.inputJointSpeed) {
        inputLabels = inputLabels.concat(Array(agent.joints.length).fill(null).map((_, idx) => `Joint Speed ${idx + 1}`));
    }

    if (stageProperties.inputAgentPos) {
        inputLabels.push("Agent's X", "Agent's Y");
    }

    if (stageProperties.inputAgentV) {
        inputLabels.push("Velocity X", "Velocity Y");
    }

    if (stageProperties.inputScore) {
        inputLabels.push("Score");
    }

    if (stageProperties.inputOrientation) {
        inputLabels.push("Orientation");
    }

    if (stageProperties.inputTimeRemaining) {
        inputLabels.push("Time Left");
    }

    if (stageProperties.inputGroundSensors) {
        inputLabels = inputLabels.concat(Array(agent.joints.length).fill(null).map((_, idx) => `Ground Sensor ${idx + 1}`));
    }

    if (stageProperties.inputDistanceSensors) {
        for (let i = 0; i < 8; i++) {
            inputLabels.push(`Sensor ${['E', 'NE', 'W', 'SE'][i]}`);
        }
    }

    if (stageProperties.outputsJointSpeed) {
        outputLabels = outputLabels.concat(Array(agent.joints.length).fill(null).map((_, idx) => `Joint ${idx + 1}`));
    }

    if (stageProperties.outputsJointTorque) {
        outputLabels = outputLabels.concat(Array(agent.joints.length).fill(null).map((_, idx) => `Joint ${idx + 1}`));
    }

    if (stageProperties.outputsBias) {
        outputLabels = outputLabels.concat(Array(agent.joints.length).fill(null).map((_, idx) => `Limb ${idx + 1}`));
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
            //if (i === nnConfig.hiddenLayers.length + 1 && j < GROUP_COLORS.length) {
            //    p.fill(GROUP_COLORS[j]);
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
                    if (stageProperties.outputsJointSpeed && agent.joints[j]) {
                        p.fill(GROUP_COLORS[j]);
                        let currentSpeed = agent.joints[j].getMotorSpeed();
                        p.text(`Speed: ${currentSpeed.toFixed(4)}`, x + 60, y + 4);
                        outputIndex++;
                    }

                    if (stageProperties.outputsJointTorque && agent.joints[j - outputIndex]) {
                        p.fill(GROUP_COLORS[j - outputIndex]);
                        p.text(`Max Torque Cant Be Polled :(`, x + 60, y + 4);
                        outputIndex++;
                    }

                    if (stageProperties.outputsBias && agent.biases[j - outputIndex]) {
                        p.fill(GROUP_COLORS[j - outputIndex]);
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

            if (stageProperties.outputsJointSpeed) {
                let adjustment = output[outputIndex] * stageProperties.maxJointSpeed * Math.min(1, Math.max(0, (this.agentEnergy / this.startingEnergy)));
                this.joints[i].setMotorSpeed(adjustment);
                outputIndex++;
            }

            if (stageProperties.outputsJointTorque) {
                let adjustment = output[outputIndex] * stageProperties.maxTorqueMultiplier + 500000;
                this.joints[i].setMaxMotorTorque(adjustment);
                outputIndex++;
            }

            if (stageProperties.outputsBias) {
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
    const MAX_X = stageProperties.maxPosForNormalisation;
    const MAX_Y = stageProperties.maxPosForNormalisation;
    const MAX_VX = stageProperties.maxVelForNormalisation;
    const MAX_VY = stageProperties.maxVelForNormalisation;
    const MAX_SPEED = stageProperties.maxJointSpeed; 
    const MAX_SCORE = stageProperties.topScoreEver;  // Max Score equaling the top score makes sense, but means the range of this input will change over the simulation.
    const MAX_TIME = stageProperties.simulationLength / stageProperties.simSpeed;  // Maximum time in seconds

    if (stageProperties.inputJointAngle) {
        // 1. Joint angles normalized to [-1, 1]
        for (let joint of this.joints) {
            let jointAngle = joint.getJointAngle() / Math.PI;
            inputs.push(jointAngle);
        }
    }

    if (stageProperties.inputJointSpeed) {
        // 2. Joint speeds normalized based on stageProperties.maxJointSpeed.  Temporally removed for simplicity
        for (let joint of this.joints) {
            let jointSpeed = joint.getJointSpeed() / MAX_SPEED;
            inputs.push(jointSpeed);
        }
    }

    let position = this.position;
    if (stageProperties.inputAgentPos) {
        // 3. Agent's position (x,y) normalized based on assumed max values
        inputs.push((position.x - this.startingX) / MAX_X);
        inputs.push((position.y - this.startingY) / MAX_Y);
    }

    let velocity = this.mainBody.getLinearVelocity();
    if (stageProperties.inputAgentV) {
        // 4. Agent's velocity (x,y) normalized based on assumed max values for now
        inputs.push(velocity.x / MAX_VX);  // You may want to use a different max speed value here
        inputs.push(velocity.y / MAX_VY);  // You may want to use a different max speed value here
    }

    if (stageProperties.inputScore) {
        // 5. Score normalized based on MAX_SCORE
        let score = this.getScore(false);
        let TScore = parseFloat(score[0]);
        inputs.push(TScore / MAX_SCORE); // I don't think this is actually useful to the agent
    }

    if (stageProperties.inputOrientation) {
        // 6. Agent's orientation normalized to [-1, 1]
        inputs.push(this.mainBody.getAngle() / Math.PI);
    }

    if (stageProperties.inputTimeRemaining) {
        // 7. Time remaining normalized to [0, 1]
        inputs.push(displayedTimeLeft / MAX_TIME);
    }

    if (stageProperties.inputDistanceSensors) {
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
    // add an if statement to only render the NN if the agents brain is not disposed
    if (!this.brain.isDisposedInternal) {
        renderNeuralNetworkNEAT(p, this, offsetX, offsetY, frameTracker);
    }
};