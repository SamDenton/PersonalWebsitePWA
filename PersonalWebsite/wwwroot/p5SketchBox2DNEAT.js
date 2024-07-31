
/***   Global Variables   ***/
let offsetY = 0;
let simulationLengthModified = 1000;
let render = true;
let singleUpdateCompleted = false;
let stabilised = false;
let updateCountStart = {};
let frameCountStart = {};
let agentIndexStart = 0;
let agentGenomePool = [];
let tempAgentGenomePool = [];
let tempAgentPool = [];
let runCount = 0;
let fixedTimeStep = 1.0 / 60.0 * 1000;
let cachedLeadingAgent = null;
let wallBodies = [];
let duplicateWalls = [];
let fps = 0;
let startingTickCounter = 0;
let fpsHistory = [];
let extendedFpsHistory = [];
let fpsCheckCounter = 0;
let panningOffsetX = 0;
let panningOffsetY = 0;
let internalTick = 1;
let skippingToGen = 0;
let stageProperties;
let averageGroupScores = [];
let averageGroupBrain = [];
let averageGroupBrainLayers = [];
let averageGroupBrainNodes = [];
let averageGroupBody = [];
//let averageBrain = [];
//let averageBrainLayers = [];
//let averageBrainNodes = [];
//let averageBody = [];
let usedIndices = new Set();
let topAgentsEver = [];
let specialRun = false;
let specialRunStarted = false;
let temporaryAgentsForSpecialRun = [];
let averageDifference;
let populationName = "Unnamed Population";

const GROUP_COLORS_NAMES = [
    'Traffic purple', 'Grass green', 'Yellow orange', 'Maize yellow', 'Quartz grey', 'Salmon range', 'Pearl black berry', 'Golden yellow', 'Pearl light grey', 'Red lilac',
    'Violet blue', 'Pure green', 'Light ivory', 'Patina green', 'Traffic yellow', 'Ocean blue', 'Pastel blue', 'Reed green', 'Luminous red', 'Turquoise blue',
    'Red Orange', 'Green', 'Very Dark Gray', 'Charcoal', 'Olive Drab', 'Very Dark Red', 'Blue', 'Magenta', 'Bright Yellow', 'Orange',
    'Teal Green', 'Strong Blue', 'Bright Magenta', 'Yellow', 'Brown', 'Gray', 'Dark Red', 'Cool Gray', 'Golden', 'Deep Red'
];

/***   Main Simulation Loops And Functions   ***/

//SketchNEAT is called once to start the simulation and it then calls draw() repeatedly.
let sketchNEAT = function (p) {

    nextBatchFrame = 0;
    fixedTimeStep = (1.0 / stageProperties.simSpeed) * 1000; // 'simulationSpeed' updates per second for physics
    let accumulator = 0;
    let lastTime = 0;
    let leadingAgent;
    let currentPhysicsBatch = 0;
    let agentUpdatesPer60Frames = 0;
    let agentUpdatesPer60FramesCounter = 0;
    let particles = [];
    const PANNING_SPEED = 5; // Speed of camera panning
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

    // Runs repeatedly after setup() has finished, acts as the main loop of the simulation
    p.draw = function () {
        p.background(stageProperties.backgroundRed, stageProperties.backgroundGreen, stageProperties.backgroundBlue);

        let currentTime = p.millis();
        let delta = currentTime - lastTime;
        lastTime = currentTime;
        leadingAgent = getLeadingAgentNEAT(p.frameCount);
        trailingAgent = getLastAgentNEAT();
        topScoreAgent = getHighestScoreNEAT();
        accumulator += delta;

        while (accumulator >= fixedTimeStep) {
            tf.tidy(() => {
                updatePhysics(p);
                accumulator -= fixedTimeStep;
            });
        }
        if (render) {
            renderScene(p);
        } else {
            renderSkip(p);
        }
    };

    // Function to update agents and the physics world. Should think about splitting this into multiple functions.
    function updatePhysics(p) {
        if (leadingAgent) {

            // If initialization is complete, update muscles 1 agent per frame for 1 update
            if (isInitializationComplete && !simulationStarted) {
                // Initialize updateCountStart and frameCountStart for all agents
                for (let i = 0; i < agents.length; i++) {
                    updateCountStart[i] = 0;
                    frameCountStart[i] = 0;
                }
                singleUpdateCompleted = false;
                agentIndexStart = 0;
                simulationStarted = true;
            }

            if (simulationStarted) {
                // If not all agents have been updated x times, update one agent per frame
                if (!stabilised) {

                    if (!singleUpdateCompleted) {

                        // Initialize or increment the update count for this agent
                        frameCountStart[agentIndexStart] = (frameCountStart[agentIndexStart] || 0) + 1;

                        // If frameCount for the agent reaches framesPerUpdate, reset it and increment updateCount
                        if (frameCountStart[agentIndexStart] >= stageProperties.framesPerUpdateStart) {

                            // Check if the agent has been updated the required number of times
                            if (updateCountStart[agentIndexStart] < stageProperties.updatesPerAgentStart) {

                                currentProcess = "Letting Agents Settle";

                                // Update the agent
                                if (!stageProperties.agentsRequireStablising) {
                                    agents[agentIndexStart].mainBody.setType('dynamic');
                                }
                                agents[agentIndexStart].updateMusclesNEAT();
                            }

                            frameCountStart[agentIndexStart] = 0;
                            updateCountStart[agentIndexStart] = (updateCountStart[agentIndexStart] || 0) + 1;
                        }

                        // Move to the next agent, and cycle back to the beginning if at the end of the array
                        agentIndexStart = (agentIndexStart + 1) % agents.length;
                    }

                    // Increment tick count each frame
                    startingTickCounter++;

                    // Check if we've updated each agent x times
                    if (Object.values(updateCountStart).every(countStart => countStart >= stageProperties.updatesPerAgentStart)) {
                        singleUpdateCompleted = true;
                        updateCountStart = [];
                        // All agents have been updated the required number of times, now check for stability
                        if (areAllAgentsStableNEAT() || stageProperties.agentsRequireStablising == false) {
                            stabilised = true;
                            // console.log("Agents Settled");
                            startingTickCounter = 0;
                        }
                    }
                }
                else {
                    // Check if it's time to update the next batch
                    if (tickCount >= nextBatchFrame) {
                        // Update muscles only for the current batch of agents
                        for (let i = currentPhysicsBatch * stageProperties.muscleBatch; i < Math.min((currentPhysicsBatch + 1) * stageProperties.muscleBatch, agents.length); i++) {
                            agents[i].mainBody.setType('dynamic');
                            agents[i].updateMusclesNEAT();

                            if (i == 0) {
                                // console.log("updating agent 0's muscles");
                                agentUpdatesPer60FramesCounter++;
                            }

                        }

                        // Move to the next batch
                        currentPhysicsBatch++;

                        // Reset to the start if all batches are processed
                        if (currentPhysicsBatch * stageProperties.muscleBatch >= agents.length) {
                            currentPhysicsBatch = 0;
                            // Wait for muscleUpdateFrames before updating muscles again
                            nextBatchFrame = tickCount + stageProperties.totalMuscleUpdateTime;
                        } else {
                            // Wait for batchDelay frames before moving to the next batch
                            nextBatchFrame = tickCount + stageProperties.muscleDelay;
                        }
                    }

                    if (tickCount % 300 === 0) {
                        agentUpdatesPer60Frames = (agentUpdatesPer60FramesCounter / 5).toFixed(2);

                        // Code block to adjust stageProperties.muscleDelay when specialRunStarted is true, so that agentUpdatesPer60Frames matches targetUpdatesPerAgent
                        //if (specialRunStarted == true) {
                        //    if (agentUpdatesPer60Frames > targetUpdatesPerAgent + 0.5 && stageProperties.muscleDelay < 10) {
                        //        stageProperties.muscleDelay++;
                        //    } else if (agentUpdatesPer60Frames < targetUpdatesPerAgent - 0.5 && stageProperties.muscleDelay > 0) {
                        //        stageProperties.muscleDelay--;
                        //    }
                        //}

                        agentUpdatesPer60FramesCounter = 0;
                    }

                }
            }


            // Allow agents to swim and interactively control their joints
            for (let agent of agents) {
                if (simulationStarted) {

                    // Apply swimming force to agents to simulate a liquid environment
                    if (stageProperties.swimMethod === "advanced") {
                        applySwimmingForce(p, agent);
                    } else {
                        applySwimmingForceOld(p, agent);
                        // applySwimmingForceOldOld(agent);
                        // Apply drag to agents to simulate a liquid environment
                        applyDrag(agent);
                    }


                    // Apply joint damping to agents to prevent limbs from moving too fast or slamming into boundaries
                    // applyJointDamping(agent);

                }
            }

            // Step the Planck world
            try {
                world.step(1 / 60 * (stageProperties.physicsGranularityMultipliers / 10), stageProperties.velocityIteration, stageProperties.positionIteration);
            } catch (error) {
                console.error("An error occurred stepping physics simulation: ", error);
            }

            // If initialization is complete, increment the tick count
            if (simulationStarted && singleUpdateCompleted && stabilised) {
                tickCount++;

                if (tickCount % 90 === 0) {
                    internalTick *= -1;
                }

                if (tickCount >= simulationLengthModified) {
                    endSimulationNEAT(p);
                }
            }
        }
    }

    // Function to render the scene and agents.  Should think about splitting this into multiple functions.
    function renderScene(p) {

        // Camera Panning with WASD Keys
        if (p.keyIsDown(65)) { // A key
            panningOffsetX += PANNING_SPEED;
        }
        if (p.keyIsDown(68)) { // D key
            panningOffsetX -= PANNING_SPEED;
        }
        if (p.keyIsDown(87)) { // W key
            panningOffsetY += PANNING_SPEED;
        }
        if (p.keyIsDown(83)) { // S key
            panningOffsetY -= PANNING_SPEED;
        }

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

        // Render memory statistics
        renderStatistics(p);

        // calculateFPSNEAT(p);
        // Render the FPS, Gen No, and Time Left
        p.fill(255);
        p.textSize(24);
        p.text(`${populationName}`, 680, 40);
        p.textSize(18);
        p.text(`FPS: ${fps}`, 10, 20);
        if (specialRunStarted == true) {
            p.text(`Special Run`, 10, 50);
        } else {
            p.text(`Batch Within Generation: ${runCount} of ${stageProperties.totalNumAgentsMultiplier}`, 10, 50);
            p.text(`Generation: ${stageProperties.genCount + 1}`, 10, 80);
        }
        p.text(`Time Left: ${displayedTimeLeft.toFixed(0)} seconds`, 10, 110);
        if (topAgentsEver.length > 0) {
            p.text(`Top Score: ${stageProperties.topScoreEver.toFixed(2)} Agent: ${topAgentsEver[0].metadata.agentName}`, 10, 140);
        } else {
            p.text(`Top Score: ${stageProperties.topScoreEver.toFixed(2)}`, 10, 140);
        }

        if (averageScore > - 10) {
            p.text(`Average Score: ${averageScore.toFixed(2)}`, 10, 170);
        } else {
            p.text(`Average Score: 0`, 10, 170);
        }

        const buttonX = stageProperties.width - 340;
        const buttonY = 75;
        const buttonWidth = 280;
        const buttonHeight = 27;
        const circleDiameter = 20;

        if (stabilised) {
            p.push();
            if (specialRun == true) {
                p.fill(0, 255, 0);
            } else {
                p.fill(255, 0, 0);
            }

            p.stroke(0);
            p.strokeWeight(3);
            p.rect(buttonX, buttonY, buttonWidth, buttonHeight, 10); // Draw a rounded rectangle button

            if (specialRun == true) {
                p.fill(0);
            } else {
                p.fill(255);
            }

            p.textSize(18);
            p.noStroke();
            p.textAlign(p.CENTER, p.CENTER);
            p.text('Run Top Agents Ever After Batch', buttonX + 139, buttonY + 13);
            p.pop();
        }

        p.mousePressed = function () {
            // Check if the special run button is clicked
            if (p.mouseX >= buttonX && p.mouseX <= buttonX + buttonWidth &&
                p.mouseY >= buttonY && p.mouseY <= buttonY + buttonHeight &&
                stabilised && !specialRunStarted) {
                specialRun = !specialRun;
                return;
            }

            // Check if the population name is clicked
            let nameX = 650;
            let nameY = 40;
            let nameWidth = 200;
            let nameHeight = 30;

            if (p.mouseX >= nameX && p.mouseX <= nameX + nameWidth &&
                p.mouseY >= nameY - nameHeight && p.mouseY <= nameY) {
                triggerNameChangePopup();
                return;
            }

            // Check if the color circles are clicked
            for (let i = 0; i < numGroups + 2; i++) {
                let x = 40 + i * (circleDiameter + 10);
                let y = 225;
                let d = p.dist(p.mouseX, p.mouseY, x, y);
                if (i == numGroups) {
                    if (d < circleDiameter / 2) {
                        selectedColor = null;
                        break;
                    }
                } else if(i == numGroups + 1) {
                    if (d < circleDiameter / 2) {
                        selectedColor = -1;
                        break;
                    }
                } else {
                    if (d < circleDiameter / 2) {
                        selectedColor = i;
                        break;
                    }
                }
            }
        };

        p.push();
        if (specialRunStarted == false) {
            p.text(`Distinct Population groups: ${numGroups}`, 10, 200);
            // Render click-able circles for each group
            for (let i = 0; i < numGroups + 2; i++) {
                p.push();
                if (i == numGroups) {
                    p.fill(255);
                    p.ellipse(40 + i * (circleDiameter + 10), 225, circleDiameter);
                } else if (i == numGroups + 1) {
                    p.fill(0);
                    p.ellipse(40 + i * (circleDiameter + 10), 225, circleDiameter);
                } else {
                    p.fill(GROUP_COLORS[i]);
                    p.ellipse(40 + i * (circleDiameter + 10), 225, circleDiameter);
                }
                p.pop();
            }

            p.fill(155);
            p.text(`Click colours to filter, black to show all or white for default`, 10, 260);
            p.text(`Agents in population: ${agentGenomePool.length + tempAgentPool.length + agents.length}`, 10, 290);
            p.text(`Agents left to run: ${agentGenomePool.length}`, 10, 320);
        }
        p.text(`Agents in simulation: ${agents.length}`, 10, 350);
        p.pop();

        if (stabilised) {
            p.push();
            p.fill(0, 255, 0);
            p.text(`Agents can go!`, 10, 410);
            p.pop();
        } else {
            p.push();
            p.fill(255, 0, 0);
            p.text(`${currentProcess}`, 10, 410);
            p.pop();
        }

        if (leadingAgent) {
            p.push();
            p.fill(255);
            if (stageProperties.agentInCentre == "leader") {
                offsetX = p.width / 6 - leadingAgent.position.x + leadingAgent.startingX + 150;
                offsetY = p.height * 4 / 6 - leadingAgent.position.y + leadingAgent.startingY;
                offsetX += panningOffsetX;
                offsetY += panningOffsetY;
                if (stageProperties.showRays) {
                    let agentOffsetX = offsetX - leadingAgent.startingX;
                    let agentOffsetY = offsetY - leadingAgent.startingY;
                    leadingAgent.renderRayCasts(p, agentOffsetX, agentOffsetY);
                }
                p.text(`Showing Leading Agent`, 370, 40);
            } else if (stageProperties.agentInCentre == "trailer") {
                offsetX = p.width / 6 - trailingAgent.position.x + trailingAgent.startingX + 150;
                offsetY = p.height * 4 / 6 - trailingAgent.position.y + trailingAgent.startingY;
                offsetX += panningOffsetX;
                offsetY += panningOffsetY;
                if (stageProperties.showRays) {
                    let agentOffsetX = offsetX - trailingAgent.startingX;
                    let agentOffsetY = offsetY - trailingAgent.startingY;
                    trailingAgent.renderRayCasts(p, agentOffsetX, agentOffsetY);
                }
                p.text(`Showing Trailing Agent`, 370, 40);
            } else if (stageProperties.agentInCentre == "average") {

                let totalXScore = 0;
                let totalYScore = 0;

                for (let agent of agents) {
                    let eachXScore = agent.getScore(false);
                    totalXScore += parseFloat(eachXScore[1]) / (stageProperties.xScoreMultiplier / 10);
                }

                for (let agent of agents) {
                    let eachYScore = agent.getScore(false);
                    totalYScore += parseFloat(eachYScore[2]) / (stageProperties.yScoreMultiplier / 10);
                }

                let averageXScore = totalXScore / agents.length;
                let averageYScore = totalYScore / agents.length;

                offsetX = (p.width / 6) - averageXScore + 150;
                offsetY = (p.height * 4 / 6) + averageYScore;
                offsetX += panningOffsetX;
                offsetY += panningOffsetY;
                p.text(`Showing Average Agent Position`, 370, 40);
            } else if (stageProperties.agentInCentre == "topScorer") {
                offsetX = p.width / 6 - topScoreAgent.position.x + topScoreAgent.startingX + 150;
                offsetY = p.height * 4 / 6 - topScoreAgent.position.y + topScoreAgent.startingY;
                offsetX += panningOffsetX;
                offsetY += panningOffsetY;
                if (stageProperties.showRays) {
                    let agentOffsetX = offsetX - topScoreAgent.startingX;
                    let agentOffsetY = offsetY - topScoreAgent.startingY;
                    topScoreAgent.renderRayCasts(p, agentOffsetX, agentOffsetY);
                }
                p.text(`Showing Top Scoring Agent`, 370, 40);
            }
            p.pop();
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
            if (stageProperties.showLeadingAgent == true) {
                agentsToRender.add(leadingAgent);
            }

            let currentTime = p.millis();

            if (currentTime - lastUIUpdateTime > stageProperties.uiRefreshRate && simulationStarted) {

                for (let agent of agents) {
                    agent.getScore(false);
                }

                fps = Number(p.frameRate().toFixed(0));

                if (stageProperties.autoAdjustPerformance == true && stabilised) {
                    adjustPerformance(fps);
                }

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
                    totalScore += agent.Score;
                }

                averageScore = totalScore / agents.length;

                displayedTimeLeft = (simulationLengthModified - tickCount) * (1 / stageProperties.simSpeed);

                // Reset the last update time
                lastUIUpdateTime = currentTime;

            }

            // Graph dimensions and positions (adjust as needed)
            let graphX = 730;
            let graphY = stageProperties.height - 600; // Position the graph at the bottom of the canvas
            let graphW = stageProperties.width / 2.3;
            let graphH = stageProperties.height / 1.8;
            let allScores;
            let minYValue;
            let maxYValue; 
            let highestScoreAgent = null;
            let totalGenerations = stageProperties.genCount - 1;

            if ((stageProperties.showScoreHistory || stageProperties.showAverageScoreHistory || stageProperties.showTopScoreHistory) && stageProperties.scoreHistory.length > 0 && !stageProperties.showNN) {
                allScores = stageProperties.scoreHistory.concat(stageProperties.scoreHistoryAverage, stageProperties.scoreHistoryTop);
                minYValue = p.min(allScores);
                maxYValue = p.max(allScores);

                if (selectedColor === -1) {
                    if (leadingAgent) {

                        let agentScoreHistory = leadingAgent.genome.agentHistory.scoreHistory;
                        let agentScoreHistoryScores = getCompleteAgentScoreHistory(agentScoreHistory, minYValue, totalGenerations);

                        if (agentScoreHistoryScores.length > 0) {
                            drawGraph(p, agentScoreHistoryScores, graphX, graphY, graphW, graphH, p.color(GROUP_COLORS[leadingAgent.genome.metadata.agentGroup]), minYValue, maxYValue);
                        }
                        highestScoreAgent = leadingAgent;
                    }
                }
                else if (selectedColor != null) {

                    let highestScore = 0;
                    highestScoreAgent = null;

                    for (let agent of agents) {
                        if (agent.genome.metadata.agentGroup === selectedColor) {
                            let agentScore = agent.Score;
                            if (agentScore > highestScore) {
                                highestScore = agentScore;
                                highestScoreAgent = agent;
                            }
                        }
                    }

                    if (highestScoreAgent) {

                        let agentScoreHistory = highestScoreAgent.genome.agentHistory.scoreHistory;
                        let agentScoreHistoryScores = getCompleteAgentScoreHistory(agentScoreHistory, minYValue, totalGenerations);

                        if (agentScoreHistoryScores.length > 0) {
                            drawGraph(p, agentScoreHistoryScores, graphX, graphY, graphW, graphH, p.color(GROUP_COLORS[selectedColor]), minYValue, maxYValue);
                        }

                    }

                } else {
                    if (leadingAgent) {

                        let agentScoreHistory = leadingAgent.genome.agentHistory.scoreHistory;
                        let agentScoreHistoryScores = getCompleteAgentScoreHistory(agentScoreHistory, minYValue, totalGenerations);

                        if (agentScoreHistoryScores.length > 0) {
                            drawGraph(p, agentScoreHistoryScores, graphX, graphY, graphW, graphH, p.color(GROUP_COLORS[leadingAgent.genome.metadata.agentGroup]), minYValue, maxYValue);
                        }
                        highestScoreAgent = leadingAgent;
                    }
                }

                drawAxes(p, graphX, graphY, graphW, graphH, minYValue, maxYValue, totalGenerations);
            }

            if (stageProperties.showScoreHistory && stageProperties.scoreHistory.length > 0 && !stageProperties.showNN) {
                let scoreShistory = stageProperties.scoreHistory;
                while (scoreShistory.length < totalGenerations) {
                    scoreShistory.unshift(minYValue);
                }
                drawGraph(p, scoreShistory, graphX, graphY, graphW, graphH, p.color(255, 0, 0), minYValue, maxYValue);
            }

            if (stageProperties.showTopScoreHistory && stageProperties.scoreHistoryTop.length > 0 && !stageProperties.showNN) {
                let scoreShistory = stageProperties.scoreHistoryTop;
                while (scoreShistory.length < totalGenerations) {
                    scoreShistory.unshift(minYValue);
                }
                drawGraph(p, scoreShistory, graphX, graphY, graphW, graphH, p.color(0, 255, 0), minYValue, maxYValue);
            }

            if (stageProperties.showAverageScoreHistory && stageProperties.scoreHistoryAverage.length > 0 && !stageProperties.showNN) {
                let scoreShistory = stageProperties.scoreHistoryAverage;
                while (scoreShistory.length < totalGenerations) {
                    scoreShistory.unshift(minYValue);
                }
                drawGraph(p, scoreShistory, graphX, graphY, graphW, graphH, p.color(255, 0, 255), minYValue, maxYValue);
            }

            // Draw the key/legend
            drawGraphKey(p, graphX + (graphW / 2) - 150, graphY - 170, highestScoreAgent);

            p.push();
            p.fill(155);
            if (specialRunStarted == true) {
                p.text(`Agents on screen: ${agents.length}`, 10, 380);
            } else {
                if (selectedColor === -1) {
                    p.text(`Agents on screen: ${agents.length}`, 10, 380);
                }
                else if (selectedColor === null) {
                    p.text(`Agents on screen: ${agentsToRender.size}`, 10, 380);
                } else {
                    p.text(`Agents on screen: ${agents.filter(agent => agent.genome.metadata.agentGroup == selectedColor).length}`, 10, 380);
                }
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

            if (stageProperties.showNN == true && stabilised == true) {
                p.push();
                if (stageProperties.agentInCentre == "trailer") {
                    p.text(`Showing Trailing Agents Brain`, 370, 20);
                    // Render NN for leading agent
                    p.fill(GROUP_COLORS[trailingAgent.genome.metadata.agentGroup]);
                    tf.tidy(() => {
                        trailingAgent.renderNNNEAT(p, stageProperties.width - 800, (stageProperties.height / 2) - 40);
                    });
                } else if (stageProperties.agentInCentre == "leader") {
                    p.text(`Showing Leading Agents Brain`, 370, 20);
                    // Render NN for leading agent
                    p.fill(GROUP_COLORS[leadingAgent.genome.metadata.agentGroup]);
                    tf.tidy(() => {
                        leadingAgent.renderNNNEAT(p, stageProperties.width - 800, (stageProperties.height / 2) - 40);
                    });
                } else if (stageProperties.agentInCentre == "topScorer") {
                    p.text(`Showing Top Scoring Agents Brain`, 370, 20);
                    // Render NN for top scoring agent
                    p.fill(GROUP_COLORS[leadingAgent.genome.metadata.agentGroup]);
                    tf.tidy(() => {
                        topScoreAgent.renderNNNEAT(p, stageProperties.width - 800, (stageProperties.height / 2) - 40);
                    });
                }
                p.pop();
            }

            let infoX = stageProperties.width - 340;
            p.push();
            p.fill(155);
            p.text("Use WASD to pan the camera", infoX, 30);
            p.text("Click on the population name to change it", infoX, 60);
            p.text(`Migration: ${(stageProperties.migrationRate / 100)}% - Diversity: ${(averageDifference * 10).toFixed(1)}`, infoX, stageProperties.height - 110);
            p.text(`Round Length: ${(simulationLengthModified)} Ticks - ${(simulationLengthModified / 60).toFixed(0)} Secs`, infoX, stageProperties.height - 80);
            p.text(`Sim Speed: ${(stageProperties.simSpeed / 60).toFixed(2)} X`, infoX, stageProperties.height - 50);
            p.text(`Updates Per Agent Per 60 Ticks: ${agentUpdatesPer60Frames}`, infoX, stageProperties.height - 20);
            p.pop();

            if (agentsToRender.size > 0 && simulationStarted) {
                if (specialRunStarted == true) {
                    for (let agent of agents) {
                        if (agent) {
                            // Render all agents from special batch
                            let agentOffsetX = offsetX - agent.startingX;
                            let agentOffsetY = offsetY - agent.startingY;
                            agent.render(p, agentOffsetX, agentOffsetY);
                        }
                    }
                } else {
                    if (selectedColor === -1) {
                        for (let agent of agents) {
                            if (agent) {
                                // Render all agents
                                let agentOffsetX = offsetX - agent.startingX;
                                let agentOffsetY = offsetY - agent.startingY;
                                agent.render(p, agentOffsetX, agentOffsetY);
                            }
                        }
                    }
                    else if (selectedColor === null) {
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
        }

    };

    // This function is called instead of the renderScene function when the simulation is being fast-forwarded
    function renderSkip(p) {
        p.text(`Fast-Forwarding to Generation: ${skippingToGen + 1}`, 10, 20);
        p.fill(255);  // Black color for the text
        p.textSize(18);  // Font size
        p.text(`FPS: ${fps}`, 10, 50);
        p.text(`Batch Within Generation: ${runCount} of ${stageProperties.totalNumAgentsMultiplier}`, 10, 80);
        p.text(`Generation: ${stageProperties.genCount + 1}`, 10, 110);
        p.text(`Time Left: ${displayedTimeLeft.toFixed(0)} seconds`, 10, 140);
        p.text(`Top Score: ${stageProperties.topScoreEver.toFixed(2)}`, 10, 170);

        if (averageScore > - 10) {
            p.text(`Average Score: ${averageScore.toFixed(2)}`, 10, 200);
        } else {
            p.text(`Average Score: 0`, 10, 170);
        }

        p.text(`Distinct Population groups: ${numGroups}`, 10, 230);
        p.push();
        p.fill(155);
        p.text(`Agents in population: ${agentGenomePool.length + tempAgentPool.length + agents.length}`, 10, 290);
        p.text(`Agents left to run: ${agentGenomePool.length}`, 10, 320);
        p.text(`Agents in simulation: ${agents.length}`, 10, 350);
        p.pop();

        if (stabilised) {
            p.push();
            p.fill(0, 255, 0);
            p.text(`Agents can go!`, 10, 410);
            p.pop();
        } else {
            p.push();
            p.fill(255, 0, 0);
            p.text(`${currentProcess}`, 10, 410);
            p.pop();
        }

        if (leadingAgent) {
            let currentTime = p.millis();

            if (currentTime - lastUIUpdateTime > stageProperties.uiRefreshRate && simulationStarted) {

                fps = Number(p.frameRate().toFixed(0));

                if (stageProperties.autoAdjustPerformance == true && stabilised) {
                    adjustPerformance(fps);
                }

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
            p.push();
            p.fill(155);
            p.text(`Current Sim Speed Multiplier: ${(stageProperties.simSpeed / 60).toFixed(2)}`, stageProperties.width - 300, stageProperties.height - 50);
            p.pop();
        }
    };
};

function triggerNameChangePopup() {
    document.getElementById('renamePopup').style.display = 'flex';
}

function closeRenamePopup() {
    document.getElementById('renamePopup').style.display = 'none';
}

function updatePopulationName() {
    var newName = document.getElementById('newPopulationName').value;
    if (newName) {
        populationName = newName;
        closeRenamePopup();
    }
}

// Fills in missing score values for each generation
function getCompleteAgentScoreHistory(agentHistory, minYValue, currentGeneration) {
    let scoreHistory = [];
    let lastKnownScore = minYValue;
    let historyIndex = 0;

    for (let gen = 0; gen <= currentGeneration; gen++) {
        if (historyIndex < agentHistory.length && agentHistory[historyIndex].generation === gen) {
            // Current generation score is available
            lastKnownScore = agentHistory[historyIndex].score;
            historyIndex++;
        }
        // Use last known score if current generation score is not available
        scoreHistory.push(lastKnownScore);
    }

    return scoreHistory;
}

// Draws a single line of the graph
function drawGraph(p, data, x, y, w, h, graphColor, minYValue, maxYValue) {
    p.push();
    p.translate(x, y);

    // Draw the graph
    p.stroke(graphColor);
    p.noFill();
    p.beginShape();
    for (let i = 0; i < data.length; i++) {
        let graphX = p.map(i, 0, data.length - 1, 0, w);
        let graphY = p.map(data[i], minYValue, maxYValue, h, 0);
        p.vertex(graphX, graphY);
    }
    p.endShape();

    // Calculate and draw the line of best fit
    let { slope, yIntercept } = calculateLineOfBestFit(data);
    drawLineOfBestFit(p, slope, yIntercept, data.length, w, h, minYValue, maxYValue, graphColor);

    p.pop();
}

// Calculates the line of best fit for the given data
function calculateLineOfBestFit(data) {
    let xSum = 0, ySum = 0, xySum = 0, x2Sum = 0;
    let n = data.length;

    for (let i = 0; i < n; i++) {
        xSum += i;
        ySum += data[i];
        xySum += i * data[i];
        x2Sum += i * i;
    }

    let slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    let yIntercept = (ySum - slope * xSum) / n;

    return { slope, yIntercept };
}

// Adds a line of best fit to each line on the graph
function drawLineOfBestFit(p, slope, yIntercept, dataLength, w, h, minYValue, maxYValue, graphColor) {
    p.stroke(graphColor); // Light grey with some opacity
    p.strokeWeight(0.5);

    let startX = 0;
    let endX = w;
    let startY = p.map(slope * 0 + yIntercept, minYValue, maxYValue, h, 0);
    let endY = p.map(slope * (dataLength - 1) + yIntercept, minYValue, maxYValue, h, 0);

    p.line(startX, startY, endX, endY);
}

// Draws the axes and grid lines for the graph
function drawAxes(p, x, y, w, h, minScore, maxScore, generations) {
    const minYValue = minScore;
    const maxYValue = maxScore;
    const numYLabels = 6;
    let numXLabels = 10;
    const yInterval = h / numYLabels;
    let xInterval = w / numXLabels;

    p.push();
    p.translate(x, y);

    // Grid lines and labels
    p.fill(0); // Black for text
    p.textSize(15);

    // Y-axis grid lines and labels
    for (let i = 0; i <= numYLabels; i++) {
        let gridYLine = yInterval * i;

        if (i != numYLabels) {
            p.stroke(200, 200, 200, 50); // Lighter gray with opacity
            p.line(0, gridYLine, w, gridYLine); // Horizontal grid lines
            gridYLine += 5;
        }

        if (generations > 0) {
            let labelValue = minYValue + (maxYValue - minYValue) * ((numYLabels - i) / numYLabels);
            p.noStroke();
            p.fill(0); // Black for text
            p.text(labelValue.toFixed(1), - 50, gridYLine - 0); // Adjust label positioning as needed
        }
    }

    if (generations < numXLabels) {
        numXLabels = generations;
        xInterval = w / numXLabels;
    }

    // X-axis grid lines and labels
    for (let i = 0; i <= numXLabels; i++) {
        let gridXLine = xInterval * i;

        if (i != 0) {
            p.stroke(200, 200, 200, 50); // Lighter gray with opacity
            p.line(gridXLine, 0, gridXLine, h); // Vertical grid lines
        }

        if (generations > 0) {
            p.noStroke();
            p.fill(0); // Black for text
            p.text(`Gen ${Math.floor(generations * i / numXLabels) + 1}`, gridXLine - 15, h + 15); // Adjust label positioning as needed
        }
    }

    // Draw Y-Axis
    p.stroke(0);
    p.line(0, 0, 0, h);

    // Draw X-Axis
    p.line(0, h, w, h);

    p.textSize(20);

    // Y-Axis Label
    p.push();
    p.translate(-60, h / 2);
    p.rotate(-p.HALF_PI);
    p.text("Score", 0 - 25, 0);
    p.pop();

    // X-Axis Label
    p.text("Generation", w / 2 - 50, h + 40);

    p.pop();
}

// Draws a key/legend for the graph
function drawGraphKey(p, x, y, highestScoreAgent = null) {
    const keySize = 20;
    let yOffset = 100;
    p.push();
    p.textSize(12);
    p.noStroke();

    if (stageProperties.showScoreHistory && stageProperties.scoreHistory.length > 0 && !stageProperties.showNN) {
        p.fill(255, 0, 0);
        p.text("Top Score Ever", x + keySize + 5, y + yOffset);
        yOffset += keySize;
    }

    if (stageProperties.showTopScoreHistory && stageProperties.scoreHistoryTop.length > 0 && !stageProperties.showNN) {
        p.fill(0, 255, 0);
        p.text("Top Score Per Generation", x + keySize + 5, y + yOffset);
        yOffset += keySize;
    }

    if (stageProperties.showAverageScoreHistory && stageProperties.scoreHistoryAverage.length > 0 && !stageProperties.showNN) {
        p.fill(255, 0, 255);
        p.text("Average Score Per Generation", x + keySize + 5, y + yOffset);
        yOffset += keySize;
    }

    if (highestScoreAgent != null) {
        p.fill(GROUP_COLORS[highestScoreAgent.genome.metadata.agentGroup]);
        p.text("Current Rendered Leader (" + highestScoreAgent.genome.metadata.groupName + ")", x + keySize + 5, y + yOffset);
    }
    p.pop();
}

// Automatically adjust the speed the simulation tries to run at based on the FPS
function adjustPerformance(fps) {
    const standardHistorySize = 10;
    const extendedHistorySize = Math.round(500 / (stageProperties.simSpeed / 60));
    let dropThreshold = 15; 
    let badFps = 35;
    let goodFps = 49;

    if (render == false) {
        // If rendering is disabled, allow the sim to run at lower fps
        badFps = 20;
        goodFps = 35;
    }

    if (specialRunStarted == true) {
        badFps = 40;
        goodFps = 49;
        dropThreshold = 20
    }

    fpsHistory.push(fps);
    extendedFpsHistory.push(fps);

    // Maintain extended history size
    if (extendedFpsHistory.length > extendedHistorySize) {
        extendedFpsHistory.shift();
    }

    if (fpsHistory.length >= standardHistorySize) {
        let averageFps = fpsHistory.reduce((sum, val) => sum + val, 0) / fpsHistory.length;
        let hasSignificantDrop = extendedFpsHistory.some(f => f < dropThreshold);

        if (averageFps < badFps && stageProperties.simSpeed > 10 && fpsHistory.length === standardHistorySize) {
            stageProperties.simSpeed = Math.max(5, stageProperties.simSpeed - 5);
            fixedTimeStep = (1.0 / stageProperties.simSpeed) * 1000;
            // console.log("Decreasing simSpeed to:" + stageProperties.simSpeed + " History: " + fpsHistory);
        } else if (averageFps > goodFps && !hasSignificantDrop && fpsHistory.length === standardHistorySize) {
            stageProperties.simSpeed += 5;
            fixedTimeStep = (1.0 / stageProperties.simSpeed) * 1000;
            // console.log("Increasing simSpeed to:", stageProperties.simSpeed + " History: " + fpsHistory);
        }
        // else if (stageProperties.simSpeed <= 10) {
            // console.log("Speed already as low as it can go!" + " History: " + fpsHistory)
        // } 

        fpsHistory = [];
    }
}

// Function that checks if all agents are stationary, within a certain threshold, for at least x frames
function areAllAgentsStableNEAT(agentsToCheck = agents) {

    // If agentsToCheck is not an array, make it an array.  Allows this function to be called with a single agent as an argument. Might use for energy recovery or similar
    if (!Array.isArray(agentsToCheck)) {
        agentsToCheck = [agentsToCheck];
    }

    // Define small thresholds for stability
    const angularStabilityThresholdLimb = stageProperties.angularStabilityThresholdLimb / 100;
    const stabilityFrames = stageProperties.stabilityFrames;  // Number of frames to wait before confirming stability

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
        }
    }

    if (allAgentsStable || startingTickCounter >= stageProperties.stabilityCheckOverwriteFrames) {
        stabilityCounter++;
        if (stabilityCounter >= stabilityFrames || startingTickCounter >= stageProperties.stabilityCheckOverwriteFrames) {
            stabilityCounter = 0;
            return true;
        }
    } else {
        stabilityCounter = 0;
    }

    return false;
}

// Helper function to calculate if the force provided matches the facing direction of the agent
function calculateBias(agentFacingDirection, forceDirection, defaultBias) {
    // Directly compute vector components
    let facingX = Math.cos(agentFacingDirection);
    let facingY = Math.sin(agentFacingDirection);
    let forceX = Math.cos(forceDirection);
    let forceY = Math.sin(forceDirection);

    let dotProduct = facingX * forceX + facingY * forceY;

    return dotProduct > 0 ? defaultBias : 2 - defaultBias;
}

// Helper function to calculate the change in angle over the last N frames
function calculateDeltaTheta(buffer, currentAngle, N) {
    buffer.push(currentAngle); // Add the current angle to the buffer

    if (buffer.length > N) {
        buffer.shift(); // Remove the oldest angle if the buffer size exceeds N
    }

    if (buffer.length === N) {
        // Calculate average of the previous angles
        let sum = buffer.reduce((acc, angle) => acc + angle, 0);
        let averagePreviousAngle = sum / buffer.length;

        // Return the absolute difference between the current angle and the average previous angle
        return (currentAngle - averagePreviousAngle);
    } else {
        return 0; // No significant movement if buffer is not full
    }
}


// Apply swimming force to each limb based on the change in angle over the last N frames. Could make this a function of the agent prototype for better encapsulation
function applySwimmingForceOld(p, agent) {

    const N = 10;// stageProperties.swimForceOverNFrames;
    const forceScalingFactor = stageProperties.swimStrength * 200;
    const maxForceMagnitude = stageProperties.maxForceMagnitude; // Maximum force magnitude

    for (let i = 0; i < agent.bodyParts.length; i++) {
        let limbBody = agent.limbs[i];
        let angle = agent.bodyParts[i].startingAngle;
        let joint = agent.joints[i];
        let currentAngle = joint.getJointAngle();
        let agentFacingDirection = agent.mainBody.getAngle();
        let limbAngle = limbBody.getAngle() + Math.PI / 2;

        // Calculate the change in angle over the last N frames
        let deltaTheta = calculateDeltaTheta(agent.limbBuffer[i], currentAngle, N);

        // Determine the direction of the force
        let forceDirection;
        if (angle < Math.PI * 2) {
            forceDirection = limbAngle - Math.PI / 2;
        } else {
            forceDirection = limbAngle - Math.PI / 2;
        }

        //let defaultBias = (!stageProperties.outputsBias || !simulationStarted || !agent.biases || i >= agent.biases.length || agent.biases[i] == null)
        //    ? stageProperties.swimBias
        //    : agent.biases[i];

        // Force magnitude is calculated based on; deltaTheta which is the change in angle over the last N frames, bias which is a value between 0 and 2 giving more control in the forward direction, the scaling factor which is a constant, then adjusted based on the limb's mass and length, length reduces the force, mass increases it.  Then modified by the agents remaining energy.
        let forceMagnitude = deltaTheta * forceScalingFactor * 1 * (agent.limbMass[i] / stageProperties.limbMassForceDivider) * (agent.bodyParts[i].length / stageProperties.limbLengthForceDivider) * agent.bodyParts[i].numberInChain * Math.min(1, Math.max(0, (agent.agentEnergy / agent.startingEnergy)));

        if (agent.agentEnergy > 0 && agent.startingEnergy > 1) {
            agent.agentEnergy -= (Math.abs(forceMagnitude / stageProperties.forceMagnitudeEnergyReductionDivider) * (stageProperties.energyUseForceSizeMult / 10)) * ((agent.limbMass[i] / stageProperties.limbMassEnergyReductionDivider) * (stageProperties.energyUseLimbSizeMult / 10)) * ((agent.brainSize / stageProperties.brainSizeEnergyReductionDivider) * (stageProperties.energyUseBrainSizeMult / 10));
        }

        let force = planck.Vec2(Math.cos(forceDirection) * forceMagnitude, Math.sin(forceDirection) * forceMagnitude);

        // Set 'forceAngle' property for visualization
        let forceAngle = Math.atan2(force.y, force.x);

        let defaultBias = stageProperties.swimBias / 10;

        // If swim bias network output is enabled, use it
        if (stageProperties.outputsBias == true) {
            defaultBias = agent.biases[i];
        }

        let bias = calculateBias(agentFacingDirection, forceAngle, defaultBias);

        let adjustedForce = force.mul(bias);

        // Create a p5.Vector for adjustedForce
        let adjustedForceVector = p.createVector(adjustedForce.x, adjustedForce.y);

        // Check if the magnitude of the vector exceeds the maxForceMagnitude
        adjustedForceVector.limit(maxForceMagnitude);

        limbBody.applyForceToCenter(planck.Vec2(adjustedForceVector.x, adjustedForceVector.y));

        // Visualize limb force
        let limbCenterPos = limbBody.getPosition();
        if (agent.currentlyLeading == true) {
            agent.drawForceVectors(p, limbCenterPos.x, limbCenterPos.y, adjustedForceVector, forceAngle);
        }
    }
}

// Apply drag to each body. Could make this a function of the agent prototype for better encapsulation
function applyDrag(agent) {
    const dragFactor = (stageProperties.liquidViscosity / 2000);
    const speedNormalization = stageProperties.speedNormalizationForDrag; //(2500)

    // Function to calculate dynamic drag based on velocity
    function calculateDynamicDrag(velocity) {
        let speed = velocity.length();
        // The drag decreases nonlinearly with increasing speed
        return 1 - Math.pow(dragFactor, 1 - (Math.pow(speed, 2) / speedNormalization));
    }

    // Apply dynamic drag to the main body's linear and angular velocities
    let bodyVelocity = agent.mainBody.getLinearVelocity();
    let bodyDynamicDrag = calculateDynamicDrag(bodyVelocity);
    agent.mainBody.setLinearVelocity(bodyVelocity.mul(bodyDynamicDrag));

    let bodyAngularVelocity = agent.mainBody.getAngularVelocity();
    agent.mainBody.setAngularVelocity(bodyAngularVelocity * bodyDynamicDrag);

    // Apply dynamic drag to each limb
    agent.bodyParts.forEach((limb, index) => {
        let limbBody = agent.limbs[index];
        let limbVelocity = limbBody.getLinearVelocity();
        let limbDynamicDrag = calculateDynamicDrag(limbVelocity);
        limbBody.setLinearVelocity(limbVelocity.mul(limbDynamicDrag));
    });
}

// Apply a force to each body based on the change in position over the last N frames.  Could make this a function of the agent prototype for better encapsulation
function applySwimmingForce(p, agent) {
    const N = stageProperties.swimForceOverNFrames; // Use the last 5 frames for force calculation
    const propulsionCoefficient = stageProperties.swimStrength * 1.75;
    const maxForceMagnitude = stageProperties.maxForceMagnitude; // Maximum force magnitude
    const displacementThreshold = 1;// stageProperties.displacementThreshold;
    const dragFactor = 0.9;
    agent.frameCounter = (agent.frameCounter || 0) + 1;
    let defaultBias = stageProperties.swimBias / 10;

    // Function to calculate propulsive force based on limb displacement
    function calculatePropulsiveForce(displacement, area) {
        let displacementMagnitude = displacement.length();
        return displacement.mul(-propulsionCoefficient * (displacementMagnitude / stageProperties.speedForceNormilizer) * area);
    }

    // Function to update buffer and calculate change in position
    function updateBufferAndGetDisplacement(buffer, newPosition) {
        buffer.push(newPosition);
        if (buffer.length > N) {
            buffer.shift();
        }
        if (buffer.length < N) {
            return planck.Vec2(0, 0);
        }

        // Calculate displacement without cloning
        let firstPosition = buffer[0];
        return planck.Vec2(newPosition.x - firstPosition.x, newPosition.y - firstPosition.y);
    }

    // Calculate and apply forces every frame
    agent.bodyParts.forEach((limb, index) => {
        let limbBody = agent.limbs[index];
        let limbLengthHalf = limb.length / 2;
        let limbAngle = limbBody.getAngle() + Math.PI / 2;

        let positions = {
            'base': calculatePointPosition(limbBody, -limbLengthHalf, limbAngle),
            'center': limbBody.getPosition(),
            'tip': calculatePointPosition(limbBody, limbLengthHalf, limbAngle)
        };

        Object.entries(positions).forEach(([key, position]) => {

            let displacement = updateBufferAndGetDisplacement(agent.limbDisplacementBuffers[index][key], position);
            let displacementMagnitude = displacement.length();

            // If limb is moving too quickly, apply drag instead of force to prevent runaway feedback loop
            if (displacementMagnitude > displacementThreshold) {

                // Apply drag based on the limb's velocity
                let limbVelocity = limbBody.getLinearVelocity();
                let dragVelocity = limbVelocity.clone().mul(dragFactor);
                limbBody.setLinearVelocity(dragVelocity);

            }
            else {

                let localArea = limb.width * limb.length * { 'base': 0.1, 'center': 0.3, 'tip': 0.5 }[key];
                let localForce = calculatePropulsiveForce(displacement, localArea);

                //let defaultBias = (!stageProperties.outputsBias || !simulationStarted || !agent.biases || index >= agent.biases.length || agent.biases[index] == null)
                //    ? (stageProperties.swimBias)
                //    : agent.biases[index];

                // Calculate the force direction for bias calculation
                let forceDirection = Math.atan2(localForce.y, localForce.x);
                let bias = calculateBias(agent.mainBody.getAngle(), forceDirection, defaultBias);
                localForce = localForce.mul(bias);
                localForce = localForce.mul(Math.min(1, Math.max(0, (agent.agentEnergy / agent.startingEnergy))))
                let adjustedForceVector = p.createVector(localForce.x, localForce.y);
                adjustedForceVector.limit(maxForceMagnitude);

                // Apply the force
                agent.lastCalculatedForces[index][key] = planck.Vec2(adjustedForceVector.x, adjustedForceVector.y);
                limbBody.applyForce(agent.lastCalculatedForces[index][key], position, true);

                // Energy reduction in this way is a bit of a hack, as it's punishing the agent for all forces applied in the facing direction.  Better than all forces, but still not ideal.
                // The correct way to do it would be to reduce the agents energy based on intentional movements, ie updates from the brain.
                if (agent.agentEnergy > 0 && agent.startingEnergy > 1 && bias > 1) {
                    agent.agentEnergy -= (Math.abs(adjustedForceVector.mag() / stageProperties.forceMagnitudeEnergyReductionDivider) * (stageProperties.energyUseForceSizeMult / 10)) * ((agent.limbMass[index] / stageProperties.limbMassEnergyReductionDivider) * (stageProperties.energyUseLimbSizeMult / 10)) * ((agent.brainSize / stageProperties.brainSizeEnergyReductionDivider) * (stageProperties.energyUseBrainSizeMult / 10));
                }

                // Visualization
                if (agent.currentlyLeading) {
                    visualizeForce(p, agent, position, adjustedForceVector);
                }
            }
        });
    });

    // Calculate and apply drag force to the main body
    let bodyDisplacement = updateBufferAndGetDisplacement(agent.bodyBuffer, agent.mainBody.getPosition());
    let bodyArea = Math.PI * Math.pow(agent.genome.mainBody.size / 5, 2); // Assuming circular body
    let bodyForce = calculatePropulsiveForce(bodyDisplacement, bodyArea);
    let forceDirection = Math.atan2(bodyForce.y, bodyForce.x);
    let bias = calculateBias(agent.mainBody.getAngle(), forceDirection, defaultBias);
    bodyForce = bodyForce.mul(bias);
    let adjustedbodyForce = p.createVector(bodyForce.x, bodyForce.y);
    adjustedbodyForce.limit(maxForceMagnitude);
    agent.mainBody.applyForceToCenter(adjustedbodyForce);

    // Visualization for the main body's drag force
    if (agent.currentlyLeading) {
        let adjustedBodyDragForce = p.createVector(adjustedbodyForce.x, adjustedbodyForce.y);
        visualizeForce(p, agent, agent.mainBody.getPosition(), adjustedBodyDragForce);
    }
}

// Helper function to calculate the position of a point on a limb
function calculatePointPosition(limbBody, offset, angle) {
    return planck.Vec2(
        limbBody.getPosition().x + offset * Math.cos(angle),
        limbBody.getPosition().y + offset * Math.sin(angle)
    );
}

// Helper function to display force vectors
function visualizeForce(p, agent, position, forceVector) {
    let forceAngle = Math.atan2(forceVector.y, forceVector.x);
    agent.drawForceVectors(p, position.x, position.y, forceVector, forceAngle);
}

// Applied a dampening force to the joints to prevent them from hitting their limb limits too hard.  Not currently used.
function applyJointDamping(agent) {
    const maxTorqueForDamping = stageProperties.maxTorqueForDamping;
    const threshold = (stageProperties.threasholdAngleForDamping / 100);

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

// Function to start the simulation and reset all global variables
function initializeSketchBox2DNEAT(StageProperties, newRound = false) {

    if (newRound) {
        topAgentsEver = [];
    }

    stageProperties = StageProperties;
    topPerformerNo = stageProperties.topPerformerNumber / 100;

    // If starting with a pre-trained population, attempt to re-construct the modified simulation length based on the number of generations
    simulationLengthModified = stageProperties.simulationLength + (stageProperties.genCount * stageProperties.simulationLengthIncrease);

    if (simulationLengthModified > stageProperties.maxSimulationLength) {
        simulationLengthModified = stageProperties.maxSimulationLength;
    }

    // Reset all global variables
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
    render = true;
    stabilised = false;
    runCount = 0;
    cachedLeadingAgent = null;
    fps = 0;
    startingTickCounter = 0;
    simulationStarted = false;
    isInitializationComplete = false;
    panningOffsetX = 0;
    panningOffsetY = 0;
    skippingToGen = 0;
    numGroups = 0;
    usedIndices = new Set();
    specialRun = false;
    specialRunStarted = false;
    averageDifference = 0;
    temporaryAgentsForSpecialRun = [];
    extendedFpsHistory = [];

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

// Function to end the simulation, triggered in the UI
function killSim() {
    // Function to kill the simulation
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

    // Reset the agents arrays
    agents = [];
    agentGenomePool = [];
    tempAgentGenomePool = [];
    tempAgentPool = [];

    populationName = "Unnamed Population";
}

// Function to log the genomes of all agents, triggered in the UI
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

    // Log all agents in either agents or agentGenomePool, ordered by the length of genome.agentHistory.mutations per agent.
    let allAgents = agentGenomePool.concat(agents.map(agent => agent.genome));
    allAgents = allAgents.concat(tempAgentPool.map(agent => agent.genome));
    allAgents.sort((a, b) => parseFloat(b.agentHistory.mutations.length) - parseFloat(a.agentHistory.mutations.length));
    console.log("All Agents Sorted by Mutation Count: ", allAgents);

    // Log the top agents ever
    console.log("Top Agents Ever: ", topAgentsEver);

    // Search through agents array for agent.limbs[x].c_position.c.x, for each limb, for any values that are NaN or negative and log them
    let badAgents = [];
    for (let agent of agents) {
        if (agent.mainBody.c_position.c.x < -1000 || isNaN(agent.mainBody.c_position.c.x) || agent.mainBody.c_position.c.x === undefined) {
            badAgents.push({ agent: agent, type: 'mainBody' });
        }
        for (let limb of agent.limbs) {
            if (limb.c_position.c.x < -1000 || isNaN(limb.c_position.c.x) || limb.c_position.c.x === undefined) {
                badAgents.push({ agent: agent, type: 'limb', limb: limb });
            }
        }
    }
    if (badAgents.length > 0) {
        console.log("Bad Agents Found:", badAgents);
    } else {
        console.log("No Bad Agents Found.");
    }
    console.log("Simulation Length: ", simulationLengthModified);
    console.log("Stage Properties: ", stageProperties);
    logStatistics();
}

// Function to render statistics about the current simulation
function renderStatistics(p) {
    // Helper function to format number with thousands separator
    const formatNumber = (num) => num.toLocaleString();

    // Memory threshold for color coding
    const memoryThresholds = {
        green: 60,
        amber: 80
    };

    let yPosition = 500;
    const xPosition = stageProperties.width - 160;
    const numberXPosition = xPosition + 80;
    const lineHeight = 15;

    p.push();
    p.textSize(12);
    p.fill('cyan');

    // Function to draw label and number in separate columns
    const drawStatLine = (label, number, color = 'cyan') => {
        p.fill(color);
        p.text(label, xPosition, yPosition);
        p.text(formatNumber(number), numberXPosition, yPosition);
        yPosition += lineHeight;
    };

    drawStatLine('Tensors:', tf.memory().numTensors);
    drawStatLine('Tensor Mem:', tf.memory().numBytes);
    drawStatLine('Bodies:', world.getBodyCount());
    drawStatLine('Joints:', world.getJointCount());

    if (window.performance && performance.memory) {
        const usedHeapPercent = (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100;
        let memoryColor = "green";
        if (usedHeapPercent > memoryThresholds.amber) memoryColor = "red";
        else if (usedHeapPercent > memoryThresholds.green) memoryColor = "orange";

        drawStatLine('Max Heap:', performance.memory.jsHeapSizeLimit);
        drawStatLine('Used Heap:', performance.memory.usedJSHeapSize);
        drawStatLine('Remaining:', performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize);
        drawStatLine('Used %:', usedHeapPercent.toFixed(2) + '%', memoryColor);
    }
    p.pop();
}

// Function to log statistics about the current simulation
function logStatistics() {
    // Format number with thousands separator
    const formatNumber = (num) => num.toLocaleString();

    // Memory threshold for color coding
    const memoryThresholds = {
        green: 60,
        amber: 80
    };

    console.log('Tensors:          %c' + formatNumber(tf.memory().numTensors), "color: cyan");
    console.log('Tensor Memory:    %c' + formatNumber(tf.memory().numBytes), "color: cyan");
    console.log("Bodies:           %c" + formatNumber(world.getBodyCount()), "color: cyan");
    console.log("Joints:           %c" + formatNumber(world.getJointCount()), "color: cyan");

    if (window.performance && performance.memory) {
        const usedHeapPercent = (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100;
        let memoryColor = "green";
        if (usedHeapPercent > memoryThresholds.amber) memoryColor = "red";
        else if (usedHeapPercent > memoryThresholds.green) memoryColor = "orange";

        console.log("Max Heap (bytes): %c" + formatNumber(performance.memory.jsHeapSizeLimit), "color: cyan");
        console.log("Used Heap:        %c" + formatNumber(performance.memory.usedJSHeapSize), "color: cyan");
        console.log("Heap Remaining:   %c" + formatNumber(performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize), `color: ${memoryColor}`);
        console.log("Used Heap %:      %c" + usedHeapPercent.toFixed(2) + "%", `color: ${memoryColor}`);
    } else {
        console.log("Performance memory API is not supported in this browser.");
    }
}

// Function to save the current genomes and settings to a local file
async function saveGenomes() {
    try {
        const db = await idb.openDB('EvolutionSimulationDB', 1);
        const tx = db.transaction('states', 'readonly');
        const storedData = await tx.store.get(1);
        await tx.done;

        if (storedData && storedData.data) {

            // stageProperties.simulationLength = simulationLengthModified;

            const data = {
                genomes: storedData.data.genomes,
                stageProperties: storedData.data.stageProperties,
                topAgent: topAgentsEver,
                name: populationName,
            };
            const jsonString = JSON.stringify(data);

            // Constructing the filename
            let filename = `${populationName}_Gen-${data.stageProperties.genCount}_TopScore-${data.stageProperties.topScoreEver.toFixed(2)}_Agents-${data.stageProperties.numAgents * data.stageProperties.totalNumAgentsMultiplier}_${data.stageProperties.swimMethod}-SwimMethod_${data.stageProperties.keepAgentSymmetrical ? 'Symmetrical' : 'Asymmetrical'}-Bodies_${data.stageProperties.networkOutput}-NetworkOutput.json`;

            saveToFile(jsonString, filename);
            console.log('Saved genomes from IndexedDB to file');
        } else {
            console.error('No data found in IndexedDB');
        }

    } catch (e) {
        console.error('Error retrieving and saving genomes from IndexedDB:', e);
    }

}

// Function to save the current settings to a local file
function saveSettings(settingsToSave) {
    const data = {
        settings: settingsToSave
    };
    const jsonString = JSON.stringify(data);
    saveToFile(jsonString, 'settings.json');
}

// Function to save the provided data to a local file
function saveToFile(data, filename) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Function to save the state to IndexedDB, called regularly
async function saveStateToIndexedDB(genomesToSave) {
    try {
        const data = {
            genomes: genomesToSave,
            stageProperties: stageProperties,
            topAgent: topAgentsEver,
            timestamp: new Date().toISOString(),
            name: populationName,
        };

        const db = await idb.openDB('EvolutionSimulationDB', 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('states')) {
                    db.createObjectStore('states', { keyPath: 'id' });
                }
            }
        });
        genomesToSave = null;
        const tx = db.transaction('states', 'readwrite');
        await tx.store.put({ id: 1, data: data });
        await tx.done;
        // console.log('State saved to IndexedDB');
    } catch (e) {
        console.error('Error saving state to IndexedDB:', e);

        // Attempt to delete the existing database.  This normally happens if users clear browser data, it clears the stores but not the database itself, so it needs to be deleted and re-created.
        try {
            await idb.deleteDB('EvolutionSimulationDB');
            console.log('Old IndexedDB deleted');

            // Retry saving after deletion
            await saveStateToIndexedDB(genomesToSave);
        } catch (deleteError) {
            console.error('Error deleting old IndexedDB:', deleteError);
        }
    }
}

// Function to recover the state from IndexedDB
async function recoverStateFromIndexedDB() {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await idb.openDB('EvolutionSimulationDB', 1);
            const tx = db.transaction('states', 'readonly');
            const storedData = await tx.store.get(1);

            if (storedData) {
                const data = storedData.data;
                let uploadedAgentGenomePool = data.genomes;
                let uploadedStageProperties = data.stageProperties;
                try {
                    let uploadedTopAgents = data.topAgent;
                    let topScoreFromHistory = Math.max(...uploadedTopAgents[0].agentHistory.scoreHistory.map(score => score.score));

                    if (topScoreFromHistory > uploadedStageProperties.topScoreEver) {
                        uploadedStageProperties.topScoreEver = topScoreFromHistory;
                    }

                    topAgentsEver = uploadedTopAgents;

                } catch (e) {
                    console.error('Error finding top agent ever:', e);
                }

                if (data.name) {
                    let uploadedName = data.name;
                    populationName = uploadedName;
                } else {
                    populationName = "Unnamed Population";
                }

                initializeSketchBox2DNEAT(uploadedStageProperties);
                initializeAgentsBox2DNEAT(uploadedAgentGenomePool);
                console.log(`Recovered state from ${data.timestamp}`);
                resolve(uploadedStageProperties); // Resolve the promise with the recovered state
            } else {
                console.log('No saved state found in IndexedDB.');
                alert('No saved state found in IndexedDB.');
                reject('No saved state found in IndexedDB.');
            }
        } catch (e) {
            console.error('Error recovering state from IndexedDB:', e);
            reject(e);
        }
    });
}

// Function to load settings from a local file
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

// Function to load genomes and stage properties from a local file
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
                    let uploadedStageProperties = data.stageProperties;
                    try {
                        let uploadedTopAgents = data.topAgent;
                        let topScoreFromHistory = Math.max(...uploadedTopAgents[0].agentHistory.scoreHistory.map(score => score.score));

                        if (topScoreFromHistory > uploadedStageProperties.topScoreEver) {
                            uploadedStageProperties.topScoreEver = topScoreFromHistory;
                        }

                        topAgentsEver = uploadedTopAgents;

                    } catch (e) {
                        console.error('Error finding top agent ever:', e);
                    }

                    if (data.name) {
                        let uploadedName = data.name;
                        populationName = uploadedName;
                    } else {
                        populationName = "Unnamed Population";
                    }

                    // Initialize or update your simulation with the new data
                    initializeSketchBox2DNEAT(uploadedStageProperties);
                    initializeAgentsBox2DNEAT(uploadedAgentGenomePool);

                    resolve(uploadedStageProperties); // Resolve the Promise with the uploaded stage properties
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

// Function to load a pre-trained genome from a selector in the UI
function loadPreTrainedGenome(filename) {
    return new Promise((resolve, reject) => {
        fetch(`./${filename}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                let uploadedAgentGenomePool = data.genomes;
                let uploadedStageProperties = data.stageProperties;
                try {
                    let uploadedTopAgents = data.topAgent;
                    let topScoreFromHistory = Math.max(...uploadedTopAgents[0].agentHistory.scoreHistory.map(score => score.score));

                    if (topScoreFromHistory > uploadedStageProperties.topScoreEver) {
                        uploadedStageProperties.topScoreEver = topScoreFromHistory;
                    }

                    topAgentsEver = uploadedTopAgents;

                } catch (e) {
                    console.error('Error finding top agent ever:', e);
                }

                if (data.name) {
                    let uploadedName = data.name;
                    populationName = uploadedName;
                } else {
                    populationName = "Unnamed Population";
                }

                initializeSketchBox2DNEAT(uploadedStageProperties);
                initializeAgentsBox2DNEAT(uploadedAgentGenomePool);

                resolve(uploadedStageProperties); // Resolve the promise with the uploaded stage properties
            })
            .catch(err => {
                console.error('Error loading pre-trained genome:', err);
                reject(err);
            });
    });
}

// Function to bring up the genome viewer for the leading agent
function showGenomes() {
    const genomeViewer = document.getElementById('genomeViewer');
    // sort the 'agents' array by agents[i].Score
    let leadingAgent = getLeadingAgentNEAT(0);
    if (leadingAgent) {
        createTreeView(genomeViewer, leadingAgent.genome);
    }
}

// Function to skip a number of generations by disabling the rendering flag and allowing the function that automatically adjusts the sim speed to target lower frame rates.
function skipGen(skipNo) {
    if (!render) {
        stageProperties.simSpeed = 60;
        fixedTimeStep = (1.0 / stageProperties.simSpeed) * 1000;
        render = true;
        skippingToGen = undefined;
        return;
    }

    if (skipNo > 0) {
        render = false;
        let currentGen = stageProperties.genCount;
        skippingToGen = currentGen + skipNo;
        let skipGenRecursive = function () {
            if (stageProperties.genCount < skippingToGen) {
                setTimeout(skipGenRecursive, 500);
            } else {
                stageProperties.simSpeed = 60;
                fixedTimeStep = (1.0 / stageProperties.simSpeed) * 1000;
                render = true;
            }
        };
        skipGenRecursive();
    }
}

// Updates the properties of the simulation, attempting to save some settings that are used for tracking things like the top score ever.
function updateSimulationNEAT(StageProperties) {
    let tempCurrentTopScore = stageProperties.topScoreEver;
    let tempGenCount = stageProperties.genCount;
    let tempTopScore = stageProperties.scoreHistoryTop;
    let tempScoreHistory = stageProperties.scoreHistory;
    let tempScoreHistoryAverage = stageProperties.scoreHistoryAverage;
    let tempMigrationRate = stageProperties.migrationRate;
    let tempMuscleBatchLocal = stageProperties.muscleBatch;
    let tempMuscleDelayLocal = stageProperties.muscleDelay;
    let tempSimSpeedLocal = stageProperties.simSpeed;
    let tempNumAgents = stageProperties.numAgents;
    let tempTotalNumAgentsMultiplier = stageProperties.totalNumAgentsMultiplier;

    // Update values in stageProperties
    stageProperties = StageProperties;
    stageProperties.topScoreEver = tempCurrentTopScore;
    stageProperties.genCount = tempGenCount;
    stageProperties.scoreHistoryTop = tempTopScore;
    stageProperties.scoreHistory = tempScoreHistory;
    stageProperties.scoreHistoryAverage = tempScoreHistoryAverage;
    stageProperties.migrationRate = tempMigrationRate;
    stageProperties.muscleBatch = tempMuscleBatchLocal;
    stageProperties.muscleDelay = tempMuscleDelayLocal;
    stageProperties.simSpeed = tempSimSpeedLocal;
    stageProperties.numAgents = tempNumAgents;
    stageProperties.totalNumAgentsMultiplier = tempTotalNumAgentsMultiplier;
}

// Function to initialize the agents, called alongside initializeSketchBox2DNEAT() to start the simulation
function initializeAgentsBox2DNEAT(totalPopulationGenomes) {
    // Reset the agents arrays
    agents = [];  
    agentGenomePool = [];
    tempAgentGenomePool = [];
    tempAgentPool = [];

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
    // saveStateToIndexedDB(totalPopulationGenomes);

    // Save population genomes to IndexedDB

    currentProcess = "Initializing first generation!";

    // let populationGenomes equal a selection of totalPopulationGenomes based on the totalPopulationGenomes[i].metadata.runGroup.  Just runGroup 0 here
    //let populationGenomes = totalPopulationGenomes.filter(genome => genome.metadata.runGroup === 0);

    // Alternative method for selecting runGroup that removes agents from the pool as they are used.
    let populationGenomes = [];
    let index = 0;

    while (index < agentGenomePool.length) {
        // Find the index of the first genome with the desired run group
        let genomeIndex = agentGenomePool.findIndex((genome, idx) => idx >= index && genome.metadata.runGroup === 0);

        if (genomeIndex === -1) {
            // No more genomes with the desired run group
            break;
        }

        // Extract the genome and add it to populationGenomes
        let [genome] = agentGenomePool.splice(genomeIndex, 1);
        populationGenomes.push(genome);

        // Adjust index to account for the removed item
        index = genomeIndex;
    }

    // Initialize agents in batches
    if (Array.isArray(populationGenomes) && populationGenomes.length === stageProperties.numAgents) {
        for (let i = 0; i < stageProperties.numAgents; i += stageProperties.batchSize) {
            initializeAgentBatchNEAT(i, Math.min(i + stageProperties.batchSize, stageProperties.numAgents), populationGenomes);
        }
    } else {
        console.log("Issue with population genomes");
        currentProcess = "Issue with population genomes!  Consider Restarting";
    }

    waitForFirstInitializationCompletionNEAT(populationGenomes);

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
        // Using genome properties to initialize the agent.  Could add spawn angle to genome metadata
        let agent = new AgentNEAT(genome);

        agent.genome.metadata.groupName = GROUP_COLORS_NAMES[agent.genome.metadata.agentGroup];
        agents.push(agent);

        if (agents.length >= stageProperties.numAgents ) {
            isInitializationComplete = true;
        }
    }, i * stageProperties.delay);
}

// Waits for the first batch of agents to be initialized before starting the simulation
function waitForFirstInitializationCompletionNEAT(populationGenomes) {
    // Check if agents initialized
    if (isInitializationComplete) {
        runCount++;

        // console.log("Run count: ", runCount);
        currentProcess = "Starting first round of simulation!";

        // Combine both arrays and map to agentGroup values
        let combinedAgentGroupValues = agentGenomePool.map(genome => genome.metadata.agentGroup)
            .concat(agents.map(agent => agent.genome.metadata.agentGroup));

        // Check if the combined array is not empty
        if (combinedAgentGroupValues.length > 0) {
            // Find the highest agentGroup value from the combined array
            numGroups = Math.max(...combinedAgentGroupValues) + 1;
        } else {
            // Default value if both arrays are empty
            numGroups = 1;
        }

        // Randomly select agents to render for each group
        randomlySelectedAgents = [];
        for (let groupId = 0; groupId < numGroups; groupId++) {
            let groupAgents = agents.filter(agent => agent.genome.metadata.agentGroup === groupId);

            // Select few random agents
            for (let i = 0; i <= stageProperties.renderedAgents; i++) {
                let randomIndex = Math.floor(Math.random() * groupAgents.length);
                randomlySelectedAgents.push(groupAgents[randomIndex]);
            }
        }

        // Manual nullification of these arrays is almost certainly not necessary, but I'm doing it anyway
        populationGenomes = null;
        let tempPopulationGenomes = [];
        agents.forEach(agent => {
            // add agent's genome to the genomes array
            tempPopulationGenomes.push(agent.genome);
        });

        // logStatistics();
        offsetX = 0;

    } else {
        // If the agents not initialized, wait for some time and check again
        setTimeout(waitForFirstInitializationCompletionNEAT, 100); // Checking every 100ms
    }
}

// Function that logs all the weights and biases of the agents brain.  Not in use currently.
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

/*****     Agent Constructor     *****/
function AgentNEAT(agentGenome) {

    /***   Agents Main Properties   ***/

    // Copy agents genome to agent object, removing from original array
    this.genome = _.cloneDeep(agentGenome);
    agentGenome = null;

    // Assign agents index locally for reference
    this.index = this.genome.metadata.agentIndex;

    // Is this agent currently leading
    this.currentlyLeading = false;

    // Give the agent a heart
    this.heart = -1;
    this.heartBeatCount = 0;

    // The starting position of the agent in the plank simulation based on the number of agents and how spread out they should be.  The render function renders all agents in 1 spot regardless of their actual position
    this.startingX = stageProperties.agentStartX + (Math.floor(this.genome.metadata.runGroup) * stageProperties.agentStartSpawnGap);
    this.startingY = stageProperties.agentStartY;

    // Create a set to store the coordinates of all covered cells, and a counter to track the number of covered cells
    this.internalMap = new Set();
    this.coveredCellCount = 0;

    // Initialize arrays to store the limbs and joints of the agent.  May need more to hold other limb types
    this.limbs = [];
    this.biases = [];
    this.limbMass = [];
    this.joints = [];
    //this.biases = [];

    // Initialize biases array so agents can evolve a different bias per limb.  Not currently in use
    //for (let i = 0; i < this.limbs; i++) {
    //    this.biases.push(1.5);
    //}

    // The number of 'front' (or back) limbs; limbs between 0.1 radians of 0 or Pi.  These are not duplicated when symmetry is enabled
    this.noFrontLimbs = 0;


    /***   Score variables   ***/

    // Initialize variables for calculating score
    this.Score = 0;

    // Initialize variables for tracking the furthest position reached
    this.furthestXPos = this.startingX;
    this.furthestYPos = this.startingY;

    // Initialize variable tracking total joint movement score
    this.totalJointMovementReward = 0;

    // Initialize variables for tracking the score bonus for larger agents
    this.massBonus = 0;

    // Initialize variables for calculating brain weight score penalty.  Not in use currently.
    this.weightPenaltyCache = null;
    this.weightPenaltyCounter = 0;


    /***   Rendering Variables   ***/

    // Initialize variables for this agents position offset for rendering
    this.offsetX;
    this.offsetY;

    // Initialize variables for rendering vision lines
    this.rayCastPoints = [];


    /***   Give The Agent A Body and Brain   ***/

    // Set properties for the main body of the agent for reference
    this.mainBodyRadius = this.genome.mainBody.size;
    let mainBodyDensity = this.genome.mainBody.density;

    // Call function to create the main body of the agent
    this.mainBody = createMainBodyNEAT(world, this.startingX, this.startingY, this.mainBodyRadius, mainBodyDensity);

    // Track the current position of the agent for reference.  Took a bit of getting my head around this, but since mainBody is an object, getPosition() will return a reference to the position function, so it will update as the value changes.
    this.position = this.mainBody.getPosition();

    // Determine a random starting angle of the agent
    this.randomAngle;
    if (stageProperties.randomAgentStartAngle == true) {
        this.randomAngle = -Math.random() * Math.PI / 2;
    } else {
        this.randomAngle = -Math.PI / 4;
    }

    // Set the agents spawn angle
    this.mainBody.setAngle(this.randomAngle);

    // Function call to update limb ID's since mutation can change the order of limbs
    updateLimbIDs(this.genome);

    // Function to flatten the limb structure into a single array for easier iteration
    this.bodyParts = flattenLimbStructure(this.genome.mainBody.arms);

    // Code to duplicate the limbs for symmetry if enabled.
    if (stageProperties.keepAgentSymmetrical === true && this.bodyParts.length > 0) {
        this.duplicateLimbsForSymmetry();
    }

    // Give the agent a brain based on the genome.  If an existing brain is passed in, use that instead of creating a new one.
    if (stageProperties.genCount === 0) {
        if (this.brain) {
            this.brain.dispose();
        }
        this.brain = createNeuralNetworkNEAT(this.genome);
    } else {
        if (this.brain) {
            this.brain.dispose();
        }
        this.brain = constructModelFromGenome(this.genome);
    }

    // Brain size is used to calculate how much energy the agent uses for movement, bigger brains use more energy.
    this.brainSize = this.genome.inputLayerGenes[0].numberOfNeurons + this.genome.outputLayerGenes[0].numberOfNeurons;
    for (let i = 0; i < this.genome.layerGenes.length; i++) {
        this.brainSize += this.genome.layerGenes[i].numberOfNeurons;
    }

    // Variable tracking the number of limbs for reference
    this.numLimbs = this.bodyParts.length;

    // Buffers for storing positions for calculating displacements and velosities in the swim function
    this.limbBuffer = Array(this.numLimbs).fill().map(() => []);
    this.bodyBuffer = Array(1).fill().map(() => []);
    this.limbDisplacementBuffers = this.bodyParts.map(() => ({
        base: [],
        center: [],
        tip: []
    }));
    this.lastCalculatedForces = this.bodyParts.map(() => ({
        base: planck.Vec2(0, 0),
        center: planck.Vec2(0, 0),
        tip: planck.Vec2(0, 0)
    }));

    // Main loop building the agents body from the flattened limb structure array.
    this.buildBodyFromLimbStructure();

    /***   Energy Variables   ***/

    // Initialize variable calculating limb mass, used for starting energy and energy use per limb
    this.limbMassTot = 0;
    if (this.limbMassTot < 10) {
        for (let i = 0; i < this.limbs.length; i++) {
            this.limbMassTot += this.limbs[i].getMass();
        }
    }

    // Calculate the starting energy of the agent.  I should make a 'calculate starting energy' function, and a 'calculate current energy' function
    if ((stageProperties.startingEnergyBodyMassMult / 10) > 0) {
        this.startingEnergy = stageProperties.startingEnergyBase + ((((this.mainBody.getMass() / stageProperties.bodyStartingMassEnergyReductionDivider) * (stageProperties.startingEnergyBodyMassMult / 10)) + ((this.limbMassTot / stageProperties.limbStartingMassEnergyReductionDivider) * stageProperties.startingEnergyLimbMassMult / 10)) * (stageProperties.simulationLength / 2000)) ** stageProperties.startingEnergyMassPower; // + body segments mass and maybe limbs later
        this.agentEnergy = this.startingEnergy;
    } else {
        this.startingEnergy = 1;
        this.agentEnergy = this.startingEnergy;
    }

    // Initialize previousJointAngles to starting angles, used for calculating joint movement score bonus.  Might be able to combine this with my buffer for joint angles for the swim function.
    this.previousJointAngles = Array(this.numLimbs).fill(0).map((_, i) => this.joints[i].getJointAngle());
}

/***   Old Function For Exploration Reward.  If I want the map as a NN input, I will need this   ***/

/*
    this.internalMap = [];
    this.coveredCellCount = 0;
    const internalMapSize = stageProperties.internalMapSize;
    const internalMapCellSize = stageProperties.internalMapCellSize;
    if ((stageProperties.explorationScoreMultiplier / 10) > 0) {
        for (let i = 0; i < internalMapSize; i++) {
            let row = [];
            for (let n = 0; n < internalMapSize; n++) {
                row.push(false);
            }
            this.internalMap.push(row);
        }
    }

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
*/

// Returns the furthest forward agent and the furthest from each species group
function getLeadingAgentNEAT(frameCounter) {

    if (agents.length === 0) return null;

    if (frameCounter % 30 === 0) {
        // Truncate randomlySelectedAgents to keep initialized picks
        randomlySelectedAgents = randomlySelectedAgents.slice(0, numGroups * stageProperties.renderedAgents);

        if (stageProperties.showGroupLeaders == true) {
            // Create an array of the leading agents from each group
            let leadingAgents = [];
            for (let groupId = 0; groupId < numGroups; groupId++) {
                let groupAgents = agents.filter(agent => agent.genome.metadata.agentGroup === groupId);

                // Select leading agent
                let leadingAgent = groupAgents.sort((a, b) => parseFloat(b.Score) - parseFloat(a.Score))[0];

                leadingAgents.push(leadingAgent);
            }

            randomlySelectedAgents.push(...leadingAgents);
        }

        // Update the cached leading agent
        let newCachedLeadingAgent = agents.reduce((leading, agent) =>
            (((agent.position.x - agent.startingX) + (1 - agent.position.y - agent.startingY)) > ((leading.position.x - leading.startingX) + (1 - leading.position.y - leading.startingY)) ? agent : leading),
            agents[0]
        );

        // Update currentlyLeading property for the overall leader
        if (cachedLeadingAgent !== newCachedLeadingAgent) {
            if (cachedLeadingAgent) cachedLeadingAgent.currentlyLeading = false;
            newCachedLeadingAgent.currentlyLeading = true;
            cachedLeadingAgent = newCachedLeadingAgent;
        }
    }

    return cachedLeadingAgent;
}

// Returns the agent with the lowest x and y position
function getLastAgentNEAT() {
    if (agents.length === 0) return null;

    return agents.reduce((trailing, agent) =>
        (((agent.position.x - agent.startingX) + (1 - agent.position.y - agent.startingY)) < ((trailing.position.x - trailing.startingX) + (1 - trailing.position.y - trailing.startingY)) ? agent : trailing),
        agents[0]
    );
}

// Returns the agent with the highest score
function getHighestScoreNEAT() {
    if (agents.length === 0) return null;

    agents.sort((a, b) => parseFloat(b.Score) - parseFloat(a.Score));

    return agents[0];
}

// Function called once the tick counter has reached the simulation length.  Ends the simulation and starts the next batch / generation
function endSimulationNEAT(p) {

    simulationStarted = false;
    stabilised = false;
    singleUpdateCompleted = false;
    isInitializationComplete = false;
    panningOffsetX = 0;
    panningOffsetY = 0;
    currentProcess = "Sorting agents by score!";

    // Reduce the sim speed before restart to reduce the initial demand on the CPU
    if (stageProperties.simSpeed > 25) {
        stageProperties.simSpeed -= 15;
        fixedTimeStep = (1.0 / stageProperties.simSpeed) * 1000;
    }

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

    const topAgentsEverLength = stageProperties.numAgents;
    let topAgentCounter = 0;

    agents.sort((a, b) => b.genome.metadata.bestScore - a.genome.metadata.bestScore);

    while (topAgentsEver.length < topAgentsEverLength) {
        topAgentsEver.push(_.cloneDeep(agents[topAgentCounter].genome));
        topAgentCounter++;
    }

    // loop through all agents scores and log them
    if (specialRun === false) {
        for (let i = 0; i < agents.length; i++) {
            let thisScore = agents[i].Score;

            agents[i].genome.agentHistory.lastScore = { score: thisScore, map: stageProperties.map, generation: stageProperties.genCount };

            agents[i].genome.agentHistory.scoreHistory.push({ score: thisScore, map: stageProperties.map, generation: stageProperties.genCount });

            agents[i].genome.agentHistory.rankInPop = (i + 1);

            if (thisScore >= topAgentsEver[topAgentsEver.length - 1].metadata.bestScore) {
                topAgentsEver.push(_.cloneDeep(agents[i].genome));
            }
        }

        if (topAgentsEver) {
            // Sort the topAgentsEver array in descending order of bestScore
            topAgentsEver.sort((a, b) => b.metadata.bestScore - a.metadata.bestScore);
        }

        // Trim the topAgentsEver array to keep only the top 'x' agents
        if (topAgentsEver.length > topAgentsEverLength) {
            topAgentsEver.length = topAgentsEverLength;
        }

        // Loop through agents array and add a simplified object to tempAgentPool
        agents.forEach(agent => {
            const simplifiedAgent = {
                genome: _.cloneDeep(agent.genome),
                Score: agent.Score,
                index: agent.index,
                brainSize: agent.brainSize
            };
            tempAgentPool.push(simplifiedAgent);
        });
    }

    if (specialRunStarted === true) {
        endSpecialRun(p);
        return;
    }

    if (specialRun && specialRunStarted === false) {
        startSpecialRun(p, topAgentsEverLength);
        return;
    }

    // Continue to the next generation once the tempAgentPool is full
    if (tempAgentPool.length >= stageProperties.numAgents * stageProperties.totalNumAgentsMultiplier) {
        nextGenerationNEAT(p);
    } else {
        nextAgentgroupNEAT(p);
    }

}

function startSpecialRun(p, topAgentsEverLength) {

    for (let i = 0; i < agents.length; i++) {
        let thisScore = agents[i].Score;

        // Check if this agent is better than the ones in topAgentsEver
        if (thisScore >= topAgentsEver[topAgentsEver.length - 1].metadata.bestScore) {
            topAgentsEver.push(_.cloneDeep(agents[i].genome));
        }
    }

    if (topAgentsEver) {
        // Sort the topAgentsEver array in descending order of bestScore
        topAgentsEver.sort((a, b) => b.metadata.bestScore - a.metadata.bestScore);
    }

    // Trim the topAgentsEver array to keep only the top 'x' agents
    if (topAgentsEver.length > topAgentsEverLength) {
        topAgentsEver.length = topAgentsEverLength;
    }

    specialRunStarted = true;
    tempSimSpeed = stageProperties.simSpeed;
    stageProperties.simSpeed = 60;
    fixedTimeStep = (1.0 / stageProperties.simSpeed) * 1000;
    currentProcess = "Starting special run!";
    temporaryAgentsForSpecialRun = _.cloneDeep(agents);

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

    agents = [];
    for (let genome of topAgentsEver) {
        let agent = new AgentNEAT(genome);
        agent.genome.metadata.runGroup = 0;
        agents.push(agent);
    }

    if (agents.length >= topAgentsEver.length) {
        isInitializationComplete = true;
        displayedTimeLeft = (simulationLengthModified - tickCount) * (1 / stageProperties.simSpeed);
        stabilityCounter = 0;
        tickCount = 0;
        nextBatchFrame = 1;
        currentPhysicsBatch = 0;
        offsetX = 0;
    }
}

function endSpecialRun(p) {
    specialRunStarted = false;
    specialRun = false;
    agents = _.cloneDeep(temporaryAgentsForSpecialRun);
    temporaryAgentsForSpecialRun = [];
    stageProperties.simSpeed = tempSimSpeed;
    fixedTimeStep = (1.0 / stageProperties.simSpeed) * 1000;

    endSimulationNEAT(p);
}

// Function called once to start the plank world.
function setupPlanckWorldNEAT() {
    // Create the Planck.js world
    // Could use the gravity property to add a 'current' to the world, rather than creating it with forces manually.  I assume this property is fixed once the world is created though
    // const gravity = planck.Vec2(0.0, stageProperties.gravity * 9.8);
    world = planck.World(planck.Vec2(0.0, 0.0));

    // Adds event listener for collisions, console logged. Will need to uncomment UserData setting for each body to use
    /*
    world.on('begin-contact', function (contact) {
        let fixtureA = contact.getFixtureA();
        let fixtureB = contact.getFixtureB();
        let bodyA = fixtureA.getBody();
        let bodyB = fixtureB.getBody();

        console.log("Collision between:", bodyA.getUserData(), "and", bodyB.getUserData());
    });
    */
    
    createMaps(stageProperties.map);
}

// Build maps for the simulation
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

    //while (mapNumber == 0 || mapNumber == 3) {
    //    mapNumber = Math.floor(Math.random() * 5);
    //}

    // mapNumber = 7;

    if (mapNumber == 0) {
        // Map starts agents in a diagonal channel, facing north east, with obstacles to get around, then opens up to free space
        let channelWidth = 300;
        let channelLength = 1100;

        startY -= 50;

        // Create the two long walls for the channel
        createWall(startX + 150, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100, 10, channelLength, Math.PI / 4); // Right wall

        // Create the short wall blocking the south west of the channel
        createWall(startX - 125, startY + 175, 10, channelWidth + 50, -Math.PI / 4); // Bottom wall

        // Obstacles along the channel
        createWall(startX + 50, startY - 130, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 400, startY - 200, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 460, startY - 530, 10, channelWidth / 2, -Math.PI / 4);

    } else if (mapNumber == 1) {
        // Map starts agents in free space and forces them to find the channel and complete it to move further
        let channelWidth = 200;
        let channelLength = 800;

        // Adjust the start position so channel is to agents north east
        startX += 400;
        startY -= 400;

        // Create the two long walls along the path
        createWall(startX + 150, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100, 10, channelLength, Math.PI / 4); // Right wall

        // Create the boundary walls to force agents through channel
        createWall(startX - 480, startY - 330, 10, 1000, -Math.PI / 4);
        createWall(startX + 380, startY + 530, 10, 1000, -Math.PI / 4);
        createWall(startX - 850, startY - 250, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 300, startY + 900, 10, channelLength, Math.PI / 4); // Right wall

        // Obstacles
        createWall(startX + 40, startY - 90, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 335, startY - 195, 10, channelWidth / 2, -Math.PI / 4);
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
        let channelWidth = 300;
        let channelLength = 1100;

        startY -= 50;
        // startX -= 50;

        // Create the two long walls along the path
        createWall(startX + 150, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100, 10, channelLength, Math.PI / 4); // Right wall

        // Create the short wall at the bottom of the path
        createWall(startX - 120, startY + 180, 10, channelWidth, -Math.PI / 4); // Bottom wall

        // Obstacles
        createWall(startX + 175, startY - 80 + 75, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 245, startY - 250, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 625, startY - 490 + 75, 10, channelWidth / 2, -Math.PI / 4);

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
        createWall(startX - 850, startY - 350, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 300, startY - 100 + 1000, 10, channelLength, Math.PI / 4); // Right wall

        // Obstacles
        createWall(startX + 110, startY + 0, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 250, startY - 245, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 560, startY - 400, 10, channelWidth / 2, -Math.PI / 4);

    } else if (mapNumber == 5) {
        const numObstacles = 150;
        const obstacleMinSize = 10;
        const obstacleMaxSize = 100;
        const mapArea = { x: -100, y: -1100, width: 2000, height: 2000 }; // Define the area for obstacle placement

        // Define a safe zone where no obstacles will be placed
        const safeZone = { x: 0, y: 400, width: 400, height: 400 };

        for (let i = 0; i < numObstacles; i++) {
            let obstacleWidth = Math.random() * (obstacleMaxSize - obstacleMinSize) + obstacleMinSize;
            let obstacleHeight = Math.random() * (obstacleMaxSize - obstacleMinSize) + obstacleMinSize;

            let obstacleX, obstacleY;

            do {
                obstacleX = mapArea.x + Math.random() * mapArea.width;
                obstacleY = mapArea.y + Math.random() * mapArea.height;
            } while (isWithinSafeZone(obstacleX, obstacleY, safeZone));

            let obstacleAngle = Math.random() * Math.PI * 2; // Random angle

            createWall(obstacleX, obstacleY, obstacleWidth, obstacleHeight, obstacleAngle);
        }
    } else if (mapNumber == 6) {
        // Map starts agents in a diagonal channel, zigzagging east
        let channelWidth = 300;
        let channelLength = 400;

        startY -= 50;

        // Create the short wall blocking the south west of the channel
        createWall(startX - 125, startY + 175, 10, channelWidth + 50, -Math.PI / 4); // Bottom wall

        // Create the two long walls for the channel
        createWall(startX, startY - 200, 10, channelLength + 300, Math.PI / 4); // Left wall
        createWall(startX + 120, startY + 170, 10, channelLength, Math.PI / 4); // Right wall
        createWall(startX + 500, startY - 200, 10, channelLength + 300, -Math.PI / 4);
        createWall(startX + 500, startY + 260, 10, channelLength + 300, -Math.PI / 4);
        createWall(startX + 1000, startY + 250, 10, channelLength + 300, Math.PI / 4);
        createWall(startX + 1000, startY - 200, 10, channelLength + 300, Math.PI / 4);
        startX += 1000;
        createWall(startX + 500, startY - 200, 10, channelLength + 300, -Math.PI / 4);
        createWall(startX + 500, startY + 260, 10, channelLength + 300, -Math.PI / 4);
        createWall(startX + 1000, startY + 250, 10, channelLength + 300, Math.PI / 4);
        createWall(startX + 1000, startY - 200, 10, channelLength + 300, Math.PI / 4);

    } else if (mapNumber == 7) {
        // Map starts agents in a diagonal channel, zigzagging north
        let channelWidth = 300;
        let channelLength = 400;

        startY -= 50;

        // Create the short wall blocking the south west of the channel
        createWall(startX - 125, startY + 175, 10, channelWidth + 50, -Math.PI / 4); // Bottom wall

        // Create the two long walls for the channel
        createWall(startX - 120, startY - 80, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 250, startY + 50, 10, channelLength + 300, Math.PI / 4); // Right wall
        createWall(startX + 250, startY - 450, 10, channelLength + 300, -Math.PI / 4);
        createWall(startX - 250, startY - 450, 10, channelLength + 300, -Math.PI / 4);
        createWall(startX + 250, startY - 950, 10, channelLength + 300, Math.PI / 4);
        createWall(startX - 250, startY - 950, 10, channelLength + 300, Math.PI / 4);
        startY -= 1000;
        createWall(startX + 250, startY - 450, 10, channelLength + 300, -Math.PI / 4);
        createWall(startX - 250, startY - 450, 10, channelLength + 300, -Math.PI / 4);
        createWall(startX + 250, startY - 950, 10, channelLength + 300, Math.PI / 4);
        createWall(startX - 250, startY - 950, 10, channelLength + 300, Math.PI / 4);

    }

}

// Helper function to check if a point is within a safe zone
function isWithinSafeZone(x, y, zone) {
    return x > zone.x && x < zone.x + zone.width && y > zone.y && y < zone.y + zone.height;
}

// Helper function to create a wall and duplicate it for as many agent spawn locations exist
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

// Function to build a TensorFlow model from a genome
function createNeuralNetworkNEAT(genome) {
    const model = tf.sequential();
    let biasID = 0;  // Initialize a counter for bias IDs

    // Input layer
    tf.tidy(() => {
        const inputLayer = tf.layers.dense({
            units: genome.inputLayerGenes[0].numberOfNeurons,
            activation: genome.inputLayerGenes[0].activationType,
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
                activation: genome.layerGenes[i].activationType,
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
            activation: genome.outputLayerGenes[0].activationType,
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
    try {
        const model = tf.sequential();

        const inputNeurons = genome.inputLayerGenes[0].numberOfNeurons;
        const inputLayer = tf.layers.dense({
            units: inputNeurons,
            inputShape: [genome.inputLayerGenes[0].inputs.length],
            activation: genome.inputLayerGenes[0].activationType
        });
        model.add(inputLayer);

        let previousLayerBiasIDMap = {};
        genome.inputLayerGenes[0].biases.forEach(b => previousLayerBiasIDMap[b.id] = b.value);

        genome.layerGenes.forEach(layerGene => {
            try {
                const layer = tf.layers.dense({
                    units: layerGene.numberOfNeurons,
                    activation: layerGene.activationType
                });
                model.add(layer);

                const weightsMatrix = new Array(Object.keys(previousLayerBiasIDMap).length).fill(null).map(() => new Array(layerGene.biases.length).fill(0));
                const biasesArray = new Array(layerGene.biases.length).fill(0);

                layerGene.weights.forEach((weightRow, rowIndex) => {
                    try {
                        weightRow.forEach(weight => {
                            const fromIndex = Object.keys(previousLayerBiasIDMap).indexOf(weight.fromNodeID.toString());
                            const toIndex = layerGene.biases.findIndex(b => b.id === weight.toNodeID);
                            if (fromIndex !== -1 && toIndex !== -1) {
                                weightsMatrix[fromIndex][toIndex] = weight.value;
                            } else {
                                console.error('Mismatch in weight index mapping', { fromNodeID: weight.fromNodeID, toNodeID: weight.toNodeID });
                                console.log("Previous layer bias ID map: ", previousLayerBiasIDMap);
                                console.log("Error in genome: ", genome);
                                console.log("From Index: ", fromIndex);
                                console.log("To Index: ", toIndex);
                            }
                        });
                    } catch (error) {
                        console.error('Error in processing weights for a layerGene', error);
                        throw error;
                    }
                });

                layerGene.biases.forEach((b, index) => biasesArray[index] = b.value);

                tf.tidy(() => {
                    layer.setWeights([
                        tf.tensor(weightsMatrix),
                        tf.tensor1d(biasesArray)
                    ]);
                });

                previousLayerBiasIDMap = {};
                layerGene.biases.forEach(b => previousLayerBiasIDMap[b.id] = b.value);
            } catch (error) {
                console.error('Error in processing layerGene', error);
                throw error;
            }
        });

        const outputLayerGene = genome.outputLayerGenes[0];
        const outputLayer = tf.layers.dense({
            units: outputLayerGene.numberOfNeurons,
            activation: outputLayerGene.activationType
        });
        model.add(outputLayer);

        const outputWeightsMatrix = new Array(Object.keys(previousLayerBiasIDMap).length).fill(null).map(() => new Array(outputLayerGene.biases.length).fill(0));
        const outputBiasesArray = new Array(outputLayerGene.biases.length).fill(0);

        outputLayerGene.weights.forEach((weightRow, rowIndex) => {
            try {
                weightRow.forEach(weight => {
                    const fromIndex = Object.keys(previousLayerBiasIDMap).indexOf(weight.fromNodeID.toString());
                    const toIndex = outputLayerGene.biases.findIndex(b => b.id === weight.toNodeID);
                    if (fromIndex !== -1 && toIndex !== -1) {
                        outputWeightsMatrix[fromIndex][toIndex] = weight.value;
                    } else {
                        console.error('Mismatch in output weight index mapping', { fromNodeID: weight.fromNodeID, toNodeID: weight.toNodeID });
                        console.log("Previous layer bias ID map: ", previousLayerBiasIDMap);
                        console.log("Error in genome: ", genome);
                        console.log("From Index: ", fromIndex);
                        console.log("To Index: ", toIndex);
                    }
                });
            } catch (error) {
                console.error('Error in processing output weights', error);
                throw error;
            }
        });

        outputLayerGene.biases.forEach((b, index) => outputBiasesArray[index] = b.value);

        tf.tidy(() => {
            outputLayer.setWeights([
                tf.tensor(outputWeightsMatrix),
                tf.tensor1d(outputBiasesArray)
            ]);
        });

        return model;
    } catch (outerError) {
        console.error("Error in constructing model from genome: ", outerError);
        console.log("Genome that caused error: ", genome);
        throw outerError; // You may choose to rethrow the error or handle it differently
    }
}


// At the end of a run, end the simulation and initialize the next batch of agents in this generation.
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
    // let populationGenomes = agentGenomePool.filter(genome => genome.metadata.runGroup === runCount);

    // New version that removes used agents from the pool to save memory
    let populationGenomes = [];
    let index = 0;

    while (index < agentGenomePool.length) {
        // Find the index of the first genome with the desired run group
        let genomeIndex = agentGenomePool.findIndex((genome, idx) => idx >= index && genome.metadata.runGroup === runCount);

        if (genomeIndex === -1) {
            // No more genomes with the desired run group
            break;
        }

        // Extract the genome and add it to populationGenomes
        let [genome] = agentGenomePool.splice(genomeIndex, 1);
        populationGenomes.push(genome);

        // Adjust index to account for the removed item
        index = genomeIndex;
    }

    // Initialize agents in batches
    if (Array.isArray(populationGenomes) && populationGenomes.length === stageProperties.numAgents) {
        for (let i = 0; i < stageProperties.numAgents; i += stageProperties.batchSize) {
            initializeAgentBatchNEAT(i, Math.min(i + stageProperties.batchSize, stageProperties.numAgents), populationGenomes);
        }
    } else {
        console.log("Issue with population genomes");
    }

    waitForInitializationCompletionBatchNEAT();

    // console.log('Restarting simulation with next set of agents!');

    // Reset simulation
    displayedTimeLeft = (simulationLengthModified - tickCount) * (1 / stageProperties.simSpeed);
    stabilityCounter = 0;
    tickCount = 0;
    nextBatchFrame = 1;
    currentPhysicsBatch = 0;
}

// Wait for all agents to be initialized before starting the next run
function waitForInitializationCompletionBatchNEAT(populationGenomes) {
    // Check if the condition is met
    if (agents.length >= stageProperties.numAgents) {
        currentProcess = "Starting next round";

        populationGenomes = [];
        randomlySelectedAgents = [];
        for (let groupId = 0; groupId < numGroups; groupId++) {
            let groupAgentsForRender = agents.filter(agent => agent.genome.metadata.agentGroup === groupId);

            // Select few random agents
            for (let i = 0; i <= stageProperties.renderedAgents; i++) {
                let randomIndex = Math.floor(Math.random() * groupAgentsForRender.length);
                randomlySelectedAgents.push(groupAgentsForRender[randomIndex]);
            }
        }

        isInitializationComplete = true;
        runCount++;
        // logStatistics();
        offsetX = 0;

    } else {
        // If the condition is not met, wait for some time and check again
        setTimeout(() => waitForInitializationCompletionBatchNEAT(), 100); // Checking every 100ms for example
    }
}

// After all agents have been run this generation, end the simulation, and create the next generation of agents
function nextGenerationNEAT(p) {

    // Clear the agentGenomePool ready for the next generation
    agentGenomePool = [];
    runCount = 0;
    currentProcess = "Performing Crossover, Mutation, and Selection on total population to create offspring";
    usedIndices = new Set();
    averageGroupScores = [];
    averageGroupBrain = [];
    averageGroupBrainLayers = [];
    averageGroupBrainNodes = [];
    averageGroupBody = [];

    //for (let agent of tempAgentPool) {
    //    if (stageProperties.keepAgentSymmetrical === true) {

    //        // Remove the additional input numberOfNeurons to keep logic consistent
    //        const originalLimbs = flattenLimbStructure(agent.genome.mainBody.arms);
    //        for (let i = 0; i < originalLimbs.length; i++) {
    //            const epsilon = 0.1;
    //            const Pi = Math.PI;
    //            const twoPi = 2 * Math.PI;
    //            // Only duplicate limbs that are not within a small range of the front or back of the agent 
    //            if (!(((originalLimbs[i].startingAngle >= 0 && originalLimbs[i].startingAngle <= epsilon) ||
    //                (originalLimbs[i].startingAngle >= Pi - epsilon && originalLimbs[i].startingAngle <= Pi + epsilon) ||
    //                (originalLimbs[i].startingAngle >= twoPi - epsilon && originalLimbs[i].startingAngle <= twoPi)) && originalLimbs[i].numberInChain == 1)) {
    //                agent.genome.inputLayerGenes[0].numberOfNeurons--;
    //                agent.genome.inputLayerGenes[0].inputs.pop();
    //            }
    //        }
    //    }
    //}

    // Probability of changing the map
    if (stageProperties.randomMap && Math.random() < stageProperties.mapChangeProbability / 100) {
        stageProperties.map = Math.floor(Math.random() * 8);
        createMaps(stageProperties.map);
    }

    // calculate average network 'pattern'
    // Will need to create a NEAT version of calculateAllAverageDistances to handle different brain shapes
    // let averageBrain = calculateAllAverageDistances();
    let topScoreThisRound = 0;
    let averageScoreThisRound = 0;
    // loop through all agents scores and log them
    for (let i = 0; i < tempAgentPool.length; i++) {
        let thisScore = tempAgentPool[i].Score;

        if (thisScore > topScoreThisRound) {
            topScoreThisRound = thisScore;
        }

        averageScoreThisRound += thisScore;
    }

    averageScoreThisRound /= tempAgentPool.length;

    if (stageProperties.scoreHistoryTop) {

        stageProperties.scoreHistory.push(stageProperties.topScoreEver);
        stageProperties.scoreHistoryAverage.push(averageScoreThisRound);
        stageProperties.scoreHistoryTop.push(topScoreThisRound);
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

    // Sort in descending order of score. No longer including the bonus for being different from the average.
    //tempAgentPool.sort((a, b) => {
    //    const aScore = a.getScore(true)[0];
    //    const bScore = b.getScore(true)[0];
    //    // Will need to create a NEAT version of distanceToAverage to handle different brain shapes
    //    // const aDistance = distanceToAverage(a, averageBrain[a.genome.metadata.agentGroup]) / 100;
    //    // const bDistance = distanceToAverage(b, averageBrain[b.genome.metadata.agentGroup]) / 100;
    //    const aDistance = 0;
    //    const bDistance = 0;
    //    // Adjust the score with the distance to the average brain
    //    const aTotal = aScore + aDistance ** 2 * 1;
    //    const bTotal = bScore + bDistance ** 2 * 1;

    //    // Sort in descending order
    //    return bTotal - aTotal;
    //});

    // Sort in descending order of score
    // tempAgentPool.sort((a, b) => b.Score - a.Score);
    rankAgents(tempAgentPool);

    //console.log("Top Agents this round!");
    //for (let i = 0; i < Math.round(topPerformerNo * stageProperties.numAgents); i++) {
    //    console.log(agents[i].index);
    //}

    function buildAgentGroups(groupId) {

        // Base case to end the recursion
        if (groupId >= numGroups) {

            // console.log('All groups built.');
            checkPopulation();
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
        // Filter group and sort in descending order of score
        //let groupAgents = tempAgentPool.filter(agent => agent.genome.metadata.agentGroup === groupId).sort((a, b) => b.Score - a.Score);

        let groupAgents = tempAgentPool.filter(agent => agent.genome.metadata.agentGroup === groupId);
        rankAgents(groupAgents);

        getAverageBody(groupAgents);
        getAverageBrain(groupAgents);
        getAverageScore(groupAgents);

        for (let i = 0; i < groupAgents.length; i++) {
            groupAgents[i].genome.agentHistory.rankInGroup = i + 1;
        }

        let agentsNeeded = groupAgents.length;
        let topPerformersCount = Math.round(topPerformerNo * agentsNeeded);

        // Ensure at least one top performer in small groups
        topPerformersCount = Math.max(topPerformersCount, 1);

        createTopPerformersNEAT(groupAgents, groupId, topPerformersCount);
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

    // console.log('Restarting simulation with evolved agents!');

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

// Recursive function checking if the new population of agents has been built using some top performers and some offspring, then build first set of agents from the new population
function waitForInitializationCompletionNEAT() {

    // Check if the condition is met
    if (tempAgentGenomePool.length >= stageProperties.numAgents * stageProperties.totalNumAgentsMultiplier) {

        // Adjust the migration rate based on the difference between the different groups average properties
        if (stageProperties.dynamicMigrationRate) {
            adjustMigrationRateBasedOnGroupDifferences();
        }

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

        if (agentGenomePool.length == stageProperties.numAgents * stageProperties.totalNumAgentsMultiplier) {
            // Save agent genomes to IndexedDB before initializing next generation
            let genomesToSave = _.cloneDeep(agentGenomePool);
            saveStateToIndexedDB(genomesToSave);
        } else {
            console.log("Agent genome pool not the correct length, revert to previous save");
            currentProcess = "Agent genome pool not the correct length, revert to previous save";
        }

        // let populationGenomes equal a selection of totalPopulationGenomes based on the agentGenomePool[i].metadata.runGroup. Can use the inter generation run counter runCount for the search
        //let populationGenomes = agentGenomePool.filter(genome => genome.metadata.runGroup === runCount);

        // New version that removes used agents from the pool to save memory
        let populationGenomes = [];
        let index = 0;

        while (index < agentGenomePool.length) {
            // Find the index of the first genome with the desired run group
            let genomeIndex = agentGenomePool.findIndex((genome, idx) => idx >= index && genome.metadata.runGroup === runCount);

            if (genomeIndex === -1) {
                // No more genomes with the desired run group
                break;
            }

            // Extract the genome and add it to populationGenomes
            let [genome] = agentGenomePool.splice(genomeIndex, 1);
            populationGenomes.push(genome);

            // Adjust index to account for the removed item
            index = genomeIndex;
        }

        // Initialize agents in batches
        if (Array.isArray(populationGenomes) && populationGenomes.length === stageProperties.numAgents) {
            for (let i = 0; i < stageProperties.numAgents; i += stageProperties.batchSize) {
                initializeAgentBatchNEAT(i, Math.min(i + stageProperties.batchSize, stageProperties.numAgents), populationGenomes);
            }
        } else {
            console.log("Issue with population genomes");
            currentProcess = "Issue with population genomes, consider restarting";
        }

        waitForFinalInitializationCompletionNEAT();

    } else {
        // If the condition is not met, wait for some time and check again
        setTimeout(() => waitForInitializationCompletionNEAT(), 100);
    }
}

// Recursive function checking if agents have finished loading into world from the newly evolved population. isInitializationComplete starts the simulation.
function waitForFinalInitializationCompletionNEAT() {
    // Check if the condition is met
    if (agents.length >= stageProperties.numAgents) {

        currentProcess = "Starting next generation";

        tempAgentGenomePool = [];
        tempAgentPool = [];

        // Randomly select agents to render for each group
        randomlySelectedAgents = [];
        for (let groupId = 0; groupId < numGroups; groupId++) {

            // Re-filter by group
            let newGroupAgents = agents.filter(agent => agent.genome.metadata.agentGroup === groupId);

            // Select few random agents
            for (let i = 0; i <= stageProperties.renderedAgents; i++) {
                let randomIndex = Math.floor(Math.random() * newGroupAgents.length);
                randomlySelectedAgents.push(newGroupAgents[randomIndex]);
            }
        }

        runCount++;
        isInitializationComplete = true;
        // logStatistics();
        offsetX = 0;

    } else {
        // If the condition is not met, wait for some time and check again
        setTimeout(() => waitForFinalInitializationCompletionNEAT(), 100);
    }
}

// Function called after each round to check if the population is the correct size and adjust if necessary
function checkPopulation() {

    try {
        const totalRequiredAgents = stageProperties.numAgents * stageProperties.totalNumAgentsMultiplier;
        let groupAgentCounts = Array(numGroups).fill(0);
        let seenIndices = new Set();

        // Count agents in each group
        // Check for duplicate indices and reassign if necessary
        tempAgentGenomePool.forEach(agentGenome => {
            if (seenIndices.has(agentGenome.metadata.agentIndex)) {
                // Duplicate found, assign a new index
                do {
                    agentGenome.metadata.agentIndex++;
                } while (usedIndices.has(agentGenome.metadata.agentIndex));
                usedIndices.add(agentGenome.metadata.agentIndex); // Update the usedIndices set
            } else {
                seenIndices.add(agentGenome.metadata.agentIndex);
            }
            groupAgentCounts[agentGenome.metadata.agentGroup]++;
        });

        // Check if total agents are too few or too many
        if (tempAgentGenomePool.length < totalRequiredAgents) {
            // Add agents to groups with the fewest agents
            while (tempAgentGenomePool.length < totalRequiredAgents) {
                let groupIdToAdd = groupAgentCounts.indexOf(Math.min(...groupAgentCounts));
                duplicateTopPerformer(groupIdToAdd);
                groupAgentCounts[groupIdToAdd]++;
            }
        } else if (tempAgentGenomePool.length > totalRequiredAgents) {
            // Remove agents from groups with the most agents
            while (tempAgentGenomePool.length > totalRequiredAgents) {
                let groupIdToRemove = groupAgentCounts.indexOf(Math.max(...groupAgentCounts));
                removeLowestPerformer(groupIdToRemove);
                groupAgentCounts[groupIdToRemove]--;
            }
        }
    } catch (error) {
        console.error("Error in checkPopulation.  numGroups: " + numGroups + " Error: " + error);
    }
}

// Helper function to duplicate the top performer in a group
function duplicateTopPerformer(groupId) {
    // Find the top performer in the group
    let topPerformer = tempAgentPool
        .filter(agent => agent.genome.metadata.agentGroup === groupId)
        .sort((a, b) => b.Score - a.Score)[0];

    console.log("Duplicating top performer:", topPerformer.genome.metadata.agentName, " In Group: ", groupId);
    let newAgentGenome = _.cloneDeep(topPerformer.genome);

    while (usedIndices.has(newAgentGenome.metadata.agentIndex)) {
        newAgentGenome.metadata.agentIndex++;
    }

    usedIndices.add(newAgentGenome.metadata.agentIndex);

    tempAgentGenomePool.push(newAgentGenome);
}

// Helper function to remove the lowest performer in a group
function removeLowestPerformer(groupId) {
    // Find the lowest performer in the group
    let lowestPerformerIndex = tempAgentGenomePool
        .map((agent, index) => ({ index, agent }))
        .filter(item => item.agent.metadata.agentGroup === groupId)
        .sort((a, b) => a.agent.Score - b.agent.Score)[0].index;

    console.log("Removing lowest performer from group: ", groupId);
    tempAgentGenomePool.splice(lowestPerformerIndex, 1);
}

function rankAgents(groupAgents) {
    groupAgents.sort((a, b) => calculateCompositeScore(b) - calculateCompositeScore(a));
}


function calculateCompositeScore(agent) {

    // I should add to this:
    // similarity heuristics, brain, body and internal map.

    let history = agent.genome.agentHistory.scoreHistory;
    let averageScore = weightedAverageScore(history) * (stageProperties.scoreHistoryWeight / 100);
    let varianceScore = scoreVariance(history);
    let ageScore = ageBasedScore(agent);
    let environmentalScore = environmentalConsistencyScore(history);
    let brainSizeScore = brainSizeMultiplier(agent);

    let compositeScore = averageScore * varianceScore * environmentalScore * ageScore * brainSizeScore;

    if (!agent.genome.agentHistory.mutations.some(mutation => mutation.includes("Gen Count: " + stageProperties.genCount))) {
        addMutationWithHistoryLimit(agent.genome.agentHistory.mutations, "Score: " + compositeScore + " = Average: " + averageScore + " * Variance: " + varianceScore + " * Age: " + ageScore + " * Environmental: " + environmentalScore + " * Brain: " + brainSizeScore);
    }

    return compositeScore;
}

function weightedAverageScore(history) {
    let recentHistory = history.slice(-10); // Consider only the last 10 scores
    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < recentHistory.length; i++) {
        let weight = 2 - ((i / recentHistory.length) ** 2); // More recent scores have higher weight.  Could use a power to give greater weight to more recent scores
        weightedSum += recentHistory[i].score * weight;
        totalWeight += weight;
    }

    return (weightedSum / totalWeight) + recentHistory[recentHistory.length - 1]; // Testing adding the most recent score to give it more weight
}

function scoreVariance(history) {
    let recentHistory = history.slice(-50);
    const mean = recentHistory.reduce((acc, h) => acc + h.score, 0) / recentHistory.length;
    const variance = recentHistory.reduce((acc, h) => acc + Math.pow(h.score - mean, 2), 0) / recentHistory.length;

    // Higher variance leads to a smaller multiplier
    return 1 + (stageProperties.scoreVarianceWeight / (1 + variance));
}


function ageBasedScore(agent) {
    // Higher age leads to a penalty
    return 1 + ((stageProperties.ageWeight / 100) / (1 + agent.genome.agentHistory.roundsAsTopPerformer));
}


function environmentalConsistencyScore(history) {
    let recentHistory = history.slice(-50);
    let mapScores = new Map();

    recentHistory.forEach(h => {
        if (!mapScores.has(h.map)) {
            mapScores.set(h.map, []);
        }
        mapScores.get(h.map).push(h.score);
    });

    let variances = Array.from(mapScores.values()).map(scores => {
        let mean = scores.reduce((acc, s) => acc + s, 0) / scores.length;
        return scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / scores.length;
    });

    // Lower variance across maps is better
    return  1 + (stageProperties.environmentalAdaptationWeight / (1 + variances.reduce((acc, v) => acc + v, 0) / variances.length));
}

function brainSizeMultiplier(agent) {
    const brainSize = agent.brainSize;
    const multiplier = 1 + (stageProperties.brainSizeWeight / (1 + brainSize));

    return multiplier;
}


// Create top performers for the next generation
function createTopPerformersNEAT(groupAgents, groupId, topPerformersCount) {

    let agentsalreadycreated = tempAgentGenomePool.filter(agentGenome => agentGenome.metadata.agentGroup === groupId).length;

    for (let j = agentsalreadycreated; j < topPerformersCount; j++) {
        let oldAgent = groupAgents[j];

        let newAgentGenome = _.cloneDeep(oldAgent.genome);

        newAgentGenome.metadata.agentGroup = oldAgent.genome.metadata.agentGroup;
        newAgentGenome.agentHistory.roundsAsTopPerformer++;

        // Chance to mutate the genome or body plan of top performers
        if (Math.random() < (stageProperties.chanceToIncludeTopPerformerInMutation / 100)) {
            newAgentGenome = mutateGenome(newAgentGenome, newAgentGenome.hyperparameters.mutationRate, newAgentGenome.hyperparameters.nodeMutationRate, newAgentGenome.hyperparameters.layerMutationRate);
        }

        if (Math.random() < (stageProperties.chanceToIncludeTopPerformerInMutation / 100)) {
            newAgentGenome = mutateBodyPlan(newAgentGenome, newAgentGenome.hyperparameters.limbMutationRate);
        }

        while (usedIndices.has(newAgentGenome.metadata.agentIndex)) {
            newAgentGenome.metadata.agentIndex++;
        }

        resetNeuralNetworkIDs(newAgentGenome);

        usedIndices.add(newAgentGenome.metadata.agentIndex);
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

        createSingleAgentChild(groupAgents, groupId, agentsNeeded);

    }
}

// Function to create a single agent child
function createSingleAgentChild(groupAgents, groupId, agentsNeeded) {

    // Select 2 parents, using different methods for varying outcomes
    let parent1;
    let parent2;
    try {

        if (Math.random() < stageProperties.chanceForTournamentSelectionForParent1 / 100) {
            parent1 = selectAgentTournamentNEAT(groupAgents, tempAgentPool);
        } else {
            parent1 = selectAgentRouletteNEAT(groupAgents, tempAgentPool);
        }

        // Loop through the roulette selection until a different parent is selected
        while (parent2 === undefined || parent2.Score === parent1.Score || parent1.genome.metadata.agentIndex === parent2.genome.metadata.agentIndex) {

            if (Math.random() < stageProperties.chanceForTournamentSelectionForParent2 / 100) {

                parent2 = selectAgentTournamentNEAT(groupAgents, tempAgentPool, parent1);
            } else {

                parent2 = selectAgentRouletteNEAT(groupAgents, tempAgentPool, parent1);
            }
        }

    } catch (error) {
        console.error("Error selecting parents: ", error);
        console.log("Group Agents: ", groupAgents);
    }

    parent1.genome.agentHistory.usedAsParent++;
    parent2.genome.agentHistory.usedAsParent++;

    let TScore1 = parent1.Score;
    let TScore2 = parent2.Score;

    // Function to create a mock agent from a genome and its top score
    function createMockAgentFromGenome(genome, submissiveParent) {
        if (!genome || !genome.agentHistory || !genome.agentHistory.scoreHistory || genome.agentHistory.scoreHistory.length === 0) {
            return null;
        }

        let mockAgent = {
            genome: genome,
            Score: 0 // Default score, to be updated
        };

        // Find the highest score in the history of topAgentEver
        let topScoreEntry = genome.agentHistory.scoreHistory.reduce((prev, current) => (prev.score > current.score) ? prev : current);
        mockAgent.Score = topScoreEntry.score;

        // Combine the score history of topAgentEver with that of the submissive parent so offspring have a complete history
        let missingHistoryLength = submissiveParent.genome.agentHistory.scoreHistory.length - genome.agentHistory.scoreHistory.length;
        if (missingHistoryLength > 0) {
            let additionalHistory = submissiveParent.genome.agentHistory.scoreHistory.slice(-missingHistoryLength);
            mockAgent.genome.agentHistory.scoreHistory = [...genome.agentHistory.scoreHistory, ...additionalHistory];
        } else {
            mockAgent.genome.agentHistory.scoreHistory = [...genome.agentHistory.scoreHistory];
        }

        return mockAgent;
    }

    let dominantParent = (TScore1 > TScore2) ? parent1 : parent2;
    let submissiveParent = (TScore1 < TScore2) ? parent1 : parent2
    let chanceForTopAgentToBeDominant = (stageProperties.chanceForTopAgentToBeDominant) ? stageProperties.chanceForTopAgentToBeDominant : 1;

    // This function might be duplicated elsewhere, I should collect my utility functions together
    function weightedRandomSelection(arr) {
        let totalWeight = arr.length * (arr.length + 1) / 2;
        let randomWeight = Math.random() * totalWeight;
        let weightSum = 0;

        for (let i = 0; i < arr.length; i++) {
            weightSum += arr.length - i;
            if (randomWeight <= weightSum) {
                return arr[i];
            }
        }

        return arr[arr.length - 1]; // Fallback to the last element
    }

    let potentialTopAgentEver = weightedRandomSelection(topAgentsEver);


    // Small chance for the dominant parent to be the topAgentEver
    if (Math.random() < chanceForTopAgentToBeDominant / 1000) {
        let mockTopAgentEver = createMockAgentFromGenome(potentialTopAgentEver, submissiveParent);
        dominantParent = mockTopAgentEver ? mockTopAgentEver : dominantParent;
        
    }


    if (dominantParent.genome.metadata.agentIndex === submissiveParent.genome.metadata.agentIndex || dominantParent.Score == submissiveParent.Score) {
        console.error("Dominant and submissive parents are the same! Dominant score: ", dominantParent.Score, " Sub score: ", submissiveParent.Score);
    }
    let childGenome;
    // let childGenome = _.cloneDeep(parent1.genome);

    try {

        // Create a child genome using crossover
        let crossoverMethod = Math.random();
        if (crossoverMethod < stageProperties.percentageOffspringFromBiasedCrossover / 100) {
            childGenome = biasedArithmeticCrossoverNEAT(dominantParent, submissiveParent);
        } else if (crossoverMethod < ((stageProperties.percentageOffspringFromBiasedCrossover / 100) + (stageProperties.percentageOffspringFromRandomCrossover / 100))) {
            childGenome = randomSelectionCrossoverNEAT(dominantParent, submissiveParent);
        } else if (crossoverMethod < ((stageProperties.percentageOffspringFromBiasedCrossover / 100) + (stageProperties.percentageOffspringFromRandomCrossover / 100) + (stageProperties.percentageOffspringFromLayerCrossover / 100))) {
            childGenome = layerCrossoverNEAT(dominantParent, submissiveParent);
        } else {
            childGenome = _.cloneDeep(dominantParent.genome); 
        }

        // Crossover the body plan
        if (Math.random() < stageProperties.chanceToIncludeOffspringInBodyCrossover / 100) {
            childGenome = bodyPlanCrossover(childGenome, submissiveParent);
        }

    } catch (error) {
        console.error("Error in crossover: ", error);
        console.log("Dominant Parent: ", dominantParent);
        console.log("Submissive Parent: ", submissiveParent);
    }

    childGenome.metadata.agentGroup = groupId;

    if (childGenome.metadata.agentIndex === submissiveParent.genome.metadata.agentIndex) {
        console.error("Wrong parent used as Dominant Parent, or same agent used for both parents!  Dominant score: ", dominantParent.Score, " Sub score: ", submissiveParent.Score);
    }

    // Update the mutation rates of agents based on similarity to the average agent.  Need to think about when this is called, as the average are calculated before crossover.
    if (stageProperties.dynamicMutationRate) {
        try {
            childGenome.hyperparameters = updateMutationRates(childGenome);
        } catch (error) {
            console.error("Error updating mutation rates: ", error);
            console.log("Child genome: ", childGenome);
        }
    }

    if (Math.random() < (stageProperties.chanceToIncludeOffspringInMutation / 100)) {
        try {
            childGenome = mutateGenome(childGenome, childGenome.hyperparameters.mutationRate, childGenome.hyperparameters.nodeMutationRate, childGenome.hyperparameters.layerMutationRate);
        } catch (error) {
            console.error("Error mutating genome: ", error);
            console.log("Child genome: ", childGenome);
        }
    }

    if (Math.random() < (stageProperties.chanceToIncludeOffspringInBodyMutation / 100)) {
        try {
            childGenome = mutateBodyPlan(childGenome, childGenome.hyperparameters.limbMutationRate);
        } catch (error) {
            console.error("Error mutating body plan: ", error);
            console.log("Child genome: ", childGenome);
        }
    }

    // Reset any bias ids that are no longer sequential.
    resetNeuralNetworkIDs(childGenome);

    // Decay all weights in the brain by a small amount
    if (stageProperties.brainDecayOverTime) {
        childGenome = decayWeights(childGenome);
    }

    let agentIndex = 0;

    // Find the next unused index
    while (usedIndices.has(agentIndex)) {
        agentIndex++;
    }

    // Mark this index as used
    usedIndices.add(agentIndex);  

    let dominantName = dominantParent.genome.metadata.agentName;
    let submissiveName = submissiveParent.genome.metadata.agentName;

    // Create a new name for the child agent based partly of the parents names, and partly a new random string
    // Function to mutate a portion of the name.  name here will be consonant + vowel + consonant
    function mutateName(name) {
        let mutationIndex = Math.floor(Math.random() * 3);
        let consonants = 'bcdfghjklmnpqrstvwxyz';
        let vowels = 'aeiou';

        if (mutationIndex === 1) {
            // Mutate vowel (middle character)
            let randomVowel = vowels.charAt(Math.floor(Math.random() * vowels.length));
            return name.substring(0, 1) + randomVowel + name.substring(2);
        } else {
            // Mutate consonant (either first or last character)
            let randomConsonant = consonants.charAt(Math.floor(Math.random() * consonants.length));
            if (mutationIndex === 0) {
                // Mutate first character
                return randomConsonant + name.substring(1);
            } else {
                // Mutate last character
                return name.substring(0, 2) + randomConsonant;
            }
        }
    }

    // Create a new name for the child agent
    let dominantPart = dominantName.substring(0, 3); // First part from dominant parent
    let submissivePart = submissiveName.substring(submissiveName.length - 3); // Second part from submissive parent

    // Apply mutation to the submissive part
    let mutationProbability = 0.25;
    if (Math.random() < mutationProbability) {
        submissivePart = mutateName(submissivePart);
    }

    // Apply mutation to the dominant part
    let dominantPartMutationProbability = 0.1;
    if (Math.random() < dominantPartMutationProbability) {
        dominantPart = mutateName(dominantPart);
    }

    let childName = dominantPart + submissivePart;
    childGenome.metadata.agentName = childName;
    childGenome.metadata.agentGroup = groupId;
    childGenome.metadata.agentIndex = agentIndex;
    childGenome.metadata.bestScore = 0;
    childGenome.agentHistory.lastScore = 0;
    childGenome.agentHistory.usedAsParent = 0;
    childGenome.agentHistory.roundsAsTopPerformer = 0;
    // childGenome.agentHistory.scoreHistory = [];

    // Once an agent is created, add to agent pool
    tempAgentGenomePool.push(childGenome);

    if (tempAgentGenomePool.filter(agentGenome => agentGenome.metadata.agentGroup === groupId).length < agentsNeeded) {
        // Schedule the next agent creation after a short timeout
        setTimeout(() => {
            createSingleAgentChild(groupAgents, groupId, agentsNeeded);
        }, 20);  // Adjust the timeout value as needed
    } else {
        return;
    }
}

// Function to select an agent using tournament selection
function selectAgentTournamentNEAT(groupAgents, allAgents, excludedAgent = null) {
    // Occasionally pick from the entire population
    if (Math.random() < (stageProperties.migrationRate / 10000)) {
        groupAgents = allAgents;
    }

    // Tournament Selection
    let tournamentContestants = [];

    // If the tournament is greater or equal to the group size, take 1 from the tournament
    let tournamentSize = Math.min(stageProperties.tournamentSize, groupAgents.length - 1);

    for (let i = 0; i < tournamentSize; i++) {
        let randomAgent;
        do {
            randomAgent = groupAgents[Math.floor(Math.random() * groupAgents.length)];
        } while (tournamentContestants.includes(randomAgent) || randomAgent == excludedAgent);
        tournamentContestants.push(randomAgent);
    }

    // Return the agent with the highest score from the tournament contestants
    return tournamentContestants.sort((a, b) => b.Score - a.Score)[0];
}

// Function to select an agent using roulette wheel selection
function selectAgentRouletteNEAT(agentsLocal, allAgents, excludedAgent = null) {
    // Occasionally pick from the entire population
    if (Math.random() < (stageProperties.migrationRate / 10000)) {
        agentsLocal = allAgents;
    }

    let normalizedScores = [];
    let minScore = Math.min(...agentsLocal.map(agent => parseFloat(agent.Score)));

    // Ensure all scores are positive
    let offsetScore = minScore < 0 ? Math.abs(minScore) : 0;

    let cumulativeSum = 0;
    for (let agent of agentsLocal) {
        if (agent != excludedAgent) {
            let score = parseFloat(agent.Score) + offsetScore;
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

// Function to perform crossover using a weighted random selection of genes from each parent
function biasedArithmeticCrossoverNEAT(agent1, agent2) {

    genome1 = agent1.genome;
    genome2 = agent2.genome;

    let dominantGenome = agent1.genome;
    let subGenome = agent2.genome;
    let childGenome = _.cloneDeep(dominantGenome);

    // addMutationWithHistoryLimit(childGenome.agentHistory.mutations, "Biased Arithmetic Child of Dominant Parent: " + dominantGenome.metadata.agentIndex + "; " + dominantGenome.metadata.agentName + " and Recessive Parent: " + subGenome.metadata.agentIndex + "; " + subGenome.metadata.agentName);

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

// Function to perform crossover using a random selection of genes from each parent
function randomSelectionCrossoverNEAT(agent1, agent2) {

    genome1 = agent1.genome;
    genome2 = agent2.genome;

    let dominantGenome = agent1.genome;
    let subGenome = agent2.genome;
    let childGenome = _.cloneDeep(dominantGenome);

    // addMutationWithHistoryLimit(childGenome.agentHistory.mutations, "Random Selection Child of Dominant Parent: " + dominantGenome.metadata.agentIndex + "; " + dominantGenome.metadata.agentName + " and Recessive Parent: " + subGenome.metadata.agentIndex + "; " + subGenome.metadata.agentName);

    // Input Layer
    for (const bias of childGenome.inputLayerGenes[0].biases) {
        let id = bias.id;
        try {
            let parent = Math.random() < 0.5 ? genome1 : genome2;
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
                    let parent = Math.random() < 0.5 ? genome1 : genome2;
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
                let parent = Math.random() < 0.5 ? genome1 : genome2;
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
                let parent = Math.random() < 0.5 ? genome1 : genome2;
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
            let parent = Math.random() < 0.5 ? genome1 : genome2;
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

// Function to perform crossover using similar methodology to 'point-to-point' crossover, but only on whole layers.  Could alter this to allow multiple concurrent layers to be swapped.
function layerCrossoverNEAT(agent1, agent2) {

    let dominantGenome = agent1.genome;
    let subGenome = agent2.genome;
    let childGenome = _.cloneDeep(dominantGenome);

    // Find swappable layers
    let swappableLayers = [];
    for (let i = 0; i < dominantGenome.length; i++) {
        if (isLayerSwappable(dominantGenome, subGenome, i)) {
            swappableLayers.push(i);
            // console.log("Swappable layer found at index: " + i);
        }
    }

    if (swappableLayers.length === 0) {
        // No swappable layers found, return a clone of a random parent's genome
        // console.log("No swappable layer found");
        return dominantGenome;
    }

    // Currently I only consider a layer swappable if that layer, the proceeding layer, and the preceding layer all match.  This is to ensure the number of nodes in the input layer remains the same.  I should build a solution that can add or remove weights to the swapped layer and following layer as needed to generalize.

    if (swappableLayers.length > 0) {
        let layerIndexToSwap = swappableLayers[Math.floor(Math.random() * swappableLayers.length)];
        console.log(`Swapping layer at index: ${layerIndexToSwap}`);

        // Perform the swap
        try {
            childGenome.layerGenes[layerIndexToSwap] = _.cloneDeep(subGenome[layerIndexToSwap]);

            // Log the mutation with layer ID
            addMutationWithHistoryLimit(childGenome.agentHistory.mutations, "Swapped Layer: " + layerIndexToSwap + " from Dominant Parent: " + dominantGenome.metadata.agentIndex + "; " + dominantGenome.metadata.agentName + " and Recessive Parent: " + subGenome.metadata.agentIndex + "; " + subGenome.metadata.agentName);
        } catch (err) {
            console.error(`Error during layer swap at index ${layerIndexToSwap}: ${err} Genome: `, childGenome);
        }
    }

    return childGenome;
}

// Helper function to check if two layers are swappable
function isLayerSwappable(genome1, genome2, layerIndex) {
    if (layerIndex === 0) {
        // Check input layer against the first hidden layer
        return layerMatches(genome1.inputLayerGenes[0], genome2.inputLayerGenes[0]) &&
            layerMatches(genome1.layerGenes[0], genome2.layerGenes[0]);
    } else if (layerIndex === genome1.layerGenes.length - 1) {
        // Check last hidden layer against the output layer
        return layerMatches(genome1.layerGenes[genome1.layerGenes.length - 1], genome2.layerGenes[genome2.layerGenes.length - 1]) &&
            layerMatches(genome1.outputLayerGenes[0], genome2.outputLayerGenes[0]);
    } else if (genome1.layerGenes[layerIndex] && genome2.layerGenes[layerIndex] && genome1.layerGenes[layerIndex + 1] && genome2.layerGenes[layerIndex + 1]) {
        // Check regular hidden layers
        return layerMatches(genome1.layerGenes[layerIndex - 1], genome2.layerGenes[layerIndex - 1]) &&
            layerMatches(genome1.layerGenes[layerIndex], genome2.layerGenes[layerIndex]);
            layerMatches(genome1.layerGenes[layerIndex + 1], genome2.layerGenes[layerIndex + 1]);
    } else {
        return false;
    }
}

// Helper function to check if two layers are the same shape
function layerMatches(layer1, layer2) {
    // Check if the number of nodes matches.
    return layer1.biases.length === layer2.biases.length; // && layer1.biases[0].id === layer2.biases[0].id; // id match was to insure the bias ids where the same after swap, but now we reset bias ids every time a genome is modified.
}

// Crosses over the body plan of two parents to create a child genome
function bodyPlanCrossover(childGenome, subAgent) {
    let submissiveParentGenome = subAgent.genome;

    // Randomly select the main body size from one of the parents
    childGenome.mainBody.size = Math.random() < 0.33 ? submissiveParentGenome.mainBody.size : childGenome.mainBody.size;

    // Randomly pick limbs from both parents to swap
    for (let i = 0; i < childGenome.mainBody.arms.length; i++) {
        let limb = childGenome.mainBody.arms[i];

        if (Math.random() < 0.25 && !stageProperties.keepAgentSymmetrical && submissiveParentGenome.mainBody.arms[i]) {
            // Find a limb in the submissive parent that is closest in starting angle to the limb in the child
            // let closestLimb = findClosestLimbForWeights(submissiveParentGenome.mainBody.arms, limb.startingAngle);

            // That was causing a bug where the same limb was being selected multiple times, so I'm just going to pick the limb at the same index for now.
            let subLimb = submissiveParentGenome.mainBody.arms[i];

            let childFlattenedLimbs = flattenLimbStructure(childGenome.mainBody.arms);

            // addMutationWithHistoryLimit(childGenome.agentHistory.mutations, "Swapped child limb chain starting from limb ID: " + limb.partID);

            // Remove the limbs, nodes, weights, and biases associated with the dominant limb to be replaced
            removeLimbChain(childGenome, limb.partID, childFlattenedLimbs);

            // Add the limbs, nodes, weights, and biases from the closest limb in the submissive parent
            addLimbChain(childGenome, subLimb, submissiveParentGenome, i);

            updateLimbIDs(childGenome);
            resetNeuralNetworkIDs(childGenome);
        }
    }

    return childGenome;
}


// Helper function to remove a limb chain from the genome
function removeLimbChain(childGenome, limbID, flattenedLimbs) {
    // Find and remove the limb with the given partID
    let limbIndex = flattenedLimbs.findIndex(limb => limb.partID === limbID);
    if (limbIndex !== -1) {
        let limbToRemove = flattenedLimbs[limbIndex];

        let nodeIDsToRemove = [];

        // Collect node IDs for the limb and its sub-limbs
        nodeIDsToRemove = collectNodeIDs(limbToRemove, childGenome, flattenedLimbs, nodeIDsToRemove);

        if (limbToRemove.numberInChain === 1) {
            // Remove the limb from the main body arms (sub-limbs will be removed automatically)
            removeLimbFromBody(childGenome.mainBody.arms, limbToRemove);
        }

        // Remove associated biases and weights using collected node IDs
        removeNeuralNetworkElements(childGenome, nodeIDsToRemove);
    } else {
        console.log("Error: Limb with partID " + limbID + " not found in flattened limb structure");
    }
}

// Helper function to collect the node IDs for a limb and its sub-limbs
function collectNodeIDs(limb, genome, flattenedLimbs, nodeIDs) {
    let limbIndex = flattenedLimbs.findIndex(l => l.partID === limb.partID);

    if (limbIndex !== -1) {
        // Add node IDs for the limb
        let inputNodeID = genome.inputLayerGenes[0].biases[limbIndex].id;
        let outputNodeID = genome.outputLayerGenes[0].biases[limbIndex].id;
        if (inputNodeID) {
            nodeIDs.push(inputNodeID);
        } else {
            // No idea whats causing this, but it seems to be working fine without it.
            // console.log("Error: Input node ID not found for limb with partID.  Using limbIndex as a backup. " + limb.partID);
            // console.log("Limb Index: ", limbIndex);
            // console.log("Genome: ", genome);
            nodeIDs.push(limbIndex);
        }
        if (outputNodeID) {
            nodeIDs.push(outputNodeID);
        } else {
            console.error("Error: Output node ID not found for limb with partID " + limb.partID);
        }

        if (limb.subArms.length > 0) {
            // Recursively add node IDs for sub-limbs
            limb.subArms.forEach(subLimb => {
                nodeIDs = collectNodeIDs(subLimb, genome, flattenedLimbs, nodeIDs);
            });
        }
    }

    return nodeIDs;
}

// Helper function to remove a limb from the body
function removeLimbFromBody(arms, limbToRemove) {
    for (let i = 0; i < arms.length; i++) {
        if (arms[i].partID === limbToRemove.partID) {
            arms.splice(i, 1);
            return;
        }
        // Don't think we need this recursion as removing the limb should remove its sub limbs automatically 
        //if (arms[i].subArms) {
        //    removeLimbFromBody(arms[i].subArms, limbToRemove);
        //}
    }
}

// Helper function to remove neural network elements associated with the removed limb
function removeNeuralNetworkElements(genome, nodeIDsToRemove) {
    // Remove biases from input and output layers and adjust numberOfNeurons
    genome.inputLayerGenes[0].biases = genome.inputLayerGenes[0].biases.filter(bias => {
        if (nodeIDsToRemove.includes(bias.id)) {
            genome.inputLayerGenes[0].numberOfNeurons--;
            genome.inputLayerGenes[0].inputs.pop();
            return false;
        }
        return true;
    });

    genome.outputLayerGenes[0].biases = genome.outputLayerGenes[0].biases.filter(bias => {
        if (nodeIDsToRemove.includes(bias.id)) {
            genome.outputLayerGenes[0].numberOfNeurons--;
            return false;
        }
        return true;
    });

    // Remove the entire weight array from the first hidden layer if its 'fromNodeID' is in 'nodeIDsToRemove'
    genome.layerGenes[0].weights = genome.layerGenes[0].weights.filter(weightsArray =>
        !nodeIDsToRemove.includes(weightsArray[0].fromNodeID)
    );

    // Remove weights associated with the collected node IDs from the output layer
    genome.outputLayerGenes[0].weights = genome.outputLayerGenes[0].weights.map(weightsArray => 
        weightsArray.filter(weight => !nodeIDsToRemove.includes(weight.toNodeID))
    );
}

// Helper function to add a limb chain to the genome
function addLimbChain(childGenome, submissiveLimb, submissiveParentGenome, childLimbIndex) {

    // Update the limbIDs to ensure uniqueness
    addChildLimbToGenome(childGenome.mainBody.arms, submissiveLimb, childLimbIndex);

    // Add corresponding neural network elements
    addNeuralNetworkElements(childGenome, submissiveLimb, submissiveParentGenome);
}

// Helper function to add a limb to the genome and increment its partID and sub-limbs' partIDs
function addChildLimbToGenome(arms, limbToAdd, childLimbIndex) {
    // Create a deep copy of the limb to add
    let newLimb = _.cloneDeep(limbToAdd);

    // Increment the partID of the new limb and its sub-limbs
    incrementPartIDs(newLimb, 100);

    // Add the updated limb to the arms array
    arms.splice(childLimbIndex, 0, newLimb);
}

// Helper function to increment the partID of a limb and its sub-limbs
function incrementPartIDs(limb, increment) {
    limb.partID += increment;

    // Recursively increment partID for sub-limbs
    if (limb.subArms && limb.subArms.length > 0) {
        limb.subArms.forEach(subLimb => {
            incrementPartIDs(subLimb, increment);
        });
    }
}

// Helper function to add neural network elements for the new limb
function addNeuralNetworkElements(childGenome, limbToAdd, submissiveParentGenome) {
    // Flatten both the submissive parent's and child's limb structures
    let submissiveFlattenedLimbs = flattenLimbStructure(submissiveParentGenome.mainBody.arms);
    let newChildFlattenedLimbs = flattenLimbStructure(childGenome.mainBody.arms);

    // Find the index of the limb to add in the submissive parent's flattened structure
    let limbIndex = submissiveFlattenedLimbs.findIndex(limb => limb.partID === limbToAdd.partID);

    // Find the index in the child where the limb (with updated ID) is located
    let limbIndexInChild = newChildFlattenedLimbs.findIndex(limb => limb.partID === limbToAdd.partID + 100);

    // Add corresponding biases to input and output layers at the appropriate index
    let submissiveInputNode = submissiveParentGenome.inputLayerGenes[0].biases[limbIndex];
    let submissiveOutputNode = submissiveParentGenome.outputLayerGenes[0].biases[limbIndex];

    let newInputNodeId;
    let newOutputNodeId;

    if (limbIndexInChild !== -1 && submissiveInputNode && submissiveOutputNode) {
        newInputNodeId = generateUniqueId(childGenome.usedBiasIDs);
        newOutputNodeId = generateUniqueId(childGenome.usedBiasIDs);

        childGenome.inputLayerGenes[0].biases.splice(limbIndexInChild, 0, _.cloneDeep(submissiveInputNode));
        childGenome.inputLayerGenes[0].biases[limbIndexInChild].id = newInputNodeId;
        childGenome.inputLayerGenes[0].numberOfNeurons++;
        childGenome.inputLayerGenes[0].inputs.push(childGenome.inputLayerGenes[0].inputs.length);

        childGenome.outputLayerGenes[0].biases.splice(limbIndexInChild, 0, _.cloneDeep(submissiveOutputNode));
        childGenome.outputLayerGenes[0].biases[limbIndexInChild].id = newOutputNodeId;
        childGenome.outputLayerGenes[0].numberOfNeurons++;
    } else {
        console.error("Error: Limb with partID " + limbToAdd.partID + " + 100");
        console.log("Flattened limb structure: ", newChildFlattenedLimbs);
        console.log("Limb Index in Child: ", limbIndexInChild);
        console.log("Submissive Input Node: ", submissiveInputNode);
        console.log("Submissive Output Node: ", submissiveOutputNode);
    }

    // Add weights associated with the new nodes
    addWeightsForNewNode(childGenome, submissiveParentGenome, submissiveInputNode.id, newInputNodeId, limbIndexInChild, true); // true for input layer
    addWeightsForNewNode(childGenome, submissiveParentGenome, submissiveOutputNode.id, newOutputNodeId, limbIndexInChild, false); // false for output layer

    // Handle sub-limbs recursively
    if (limbToAdd.subArms.length > 0) {
        limbToAdd.subArms.forEach(subLimb => {
            addNeuralNetworkElements(childGenome, subLimb, submissiveParentGenome);
        });
    }
}

// Helper function to add weights for the new node
function addWeightsForNewNode(childGenome, parentGenome, oldNodeId, newNodeId, limbIndexInChild, isInputLayer) {
    try {
        let parentLayer = isInputLayer ? parentGenome.layerGenes[0] : parentGenome.outputLayerGenes[0];
        let childLayer = isInputLayer ? childGenome.layerGenes[0] : childGenome.outputLayerGenes[0];

        // Prepare a list of existing node IDs for the layer
        let existingNodeIds = isInputLayer ? childGenome.layerGenes[0].biases.map(bias => bias.id)
            : childGenome.layerGenes[childGenome.layerGenes.length - 1].biases.map(bias => bias.id);

        if (isInputLayer) {
            let weightsToAdd = parentLayer.weights.filter(weightArray => weightArray.some(weight => weight.fromNodeID === oldNodeId));
            if (weightsToAdd.length > 0) {
                let clonedWeights = weightsToAdd.map(weightArray =>
                    weightArray.map(weight => ({
                        ...weight,
                        fromNodeID: newNodeId,
                        toNodeID: existingNodeIds[weightArray.indexOf(weight)]
                    }))
                );
                let weightsToAddAdjusted = adjustWeightsLength(clonedWeights.flat(), existingNodeIds, true);
                childLayer.weights.splice(limbIndexInChild, 0, weightsToAddAdjusted);
            } else {
                console.log("Parent Layer: ", parentLayer);
                throw new Error("Error: Weights to add not found for input layer");
            }
        } else { // Output layer
            let weightsToAdd = [];
            parentLayer.weights.forEach((weightArray, idx) => {
                let weight = weightArray.find(weight => weight.toNodeID === oldNodeId);
                if (weight) {
                    weightsToAdd.push({ ...weight, toNodeID: newNodeId, fromNodeID: existingNodeIds[idx] });
                }
            });

            let weightsToAddAdjusted = adjustWeightsLength(weightsToAdd, existingNodeIds, false);

            try {
                childLayer.weights.forEach((weightArray, index) => {
                    weight = weightsToAddAdjusted[index];
                    weightArray.splice(limbIndexInChild, 0, weight);
                });
            } catch (e) {
                console.log("Child Layer: ", childLayer);
                console.log("Parent Layer: ", parentLayer);
                console.log("weightsToAdd: ", weightsToAdd);
                console.log("weightsToAddAdjusted: ", weightsToAddAdjusted);
                throw e;
            }
        }
    } catch (e) {
        console.error("Error in addWeightsForNewNode: ", e);
        console.log("Child Genome: ", childGenome);
        console.log("Parent Genome: ", parentGenome);
        console.log("Old Node ID: ", oldNodeId);
        console.log("New Node ID: ", newNodeId);
        console.log("Limb Index in Child: ", limbIndexInChild);
        console.log("Is Input Layer: ", isInputLayer);
    }
}

// Helper function to correct the length of weights array
function adjustWeightsLength(weightsArray, existingNodeIds, isInputScenario) {

    let filteredWeightsArray;

    // Filter out extra weights
    if (isInputScenario) {
        filteredWeightsArray = weightsArray.filter(weight => existingNodeIds.includes(weight.toNodeID));
    } else {
        filteredWeightsArray = weightsArray.filter(weight => existingNodeIds.includes(weight.fromNodeID));
    }

    try {
        // Add new weights to match target length
        while (filteredWeightsArray.length < existingNodeIds.length) {
            if (isInputScenario) {
                let toNodeID = existingNodeIds.find(id => !filteredWeightsArray.some(weight => weight.toNodeID === id));
                filteredWeightsArray.push({
                    fromNodeID: filteredWeightsArray[0].fromNodeID,
                    toNodeID: toNodeID,
                    value: Math.random()
                });
            } else {
                let fromNodeID = existingNodeIds.find(id => !filteredWeightsArray.some(weight => weight.fromNodeID === id));
                filteredWeightsArray.push({
                    fromNodeID: fromNodeID,
                    toNodeID: filteredWeightsArray[0].toNodeID,
                    value: Math.random()
                });
            }
        }

        return filteredWeightsArray;
    } catch (e) {
        console.error("Error in adjustWeightsLength: ", e);
        console.log("Weights Array: ", weightsArray);
        console.log("Filtered Weights Array: ", filteredWeightsArray);
        console.log("Existing Node IDs: ", existingNodeIds);

        return weightsArray;
    }
}

// Function to update dynamic mutation rates based on the agent's performance and similarity to others
function updateMutationRates(genome) {
    let hyperparams = genome.hyperparameters;

    // Helper function to round mutation rates and clamp between 0 and 0.5
    const roundRate = (rate) => Math.min(0.5, Math.max(0, rate.toFixed(8)));

    // Check if the score is plateauing
    const scorePlateauingAgent = isScorePlateauing(genome.agentHistory.scoreHistory, true);
    const scorePlateauingPopulation = isScorePlateauing(stageProperties.scoreHistoryAverage);

    // Function to adjust mutation rates based on plateauing
    const adjustForPlateauing = (rate, increasingFactor, decreasingFactor) => {
        if (scorePlateauingAgent) {
            return roundRate(rate * increasingFactor);
        } else {
            return roundRate(rate * decreasingFactor);
        }

        if (scorePlateauingPopulation) {
            return roundRate(rate * increasingFactor);
        } else {
            return roundRate(rate * decreasingFactor);
        }
    };

    // Adjust mutation rates based on scores
    hyperparams.limbMutationRate = adjustForPlateauing(hyperparams.limbMutationRate, stageProperties.adjustLimbMutationUpPlateau / 10000, stageProperties.adjustLimbMutationDownPlateau / 10000);
    hyperparams.mutationRate = adjustForPlateauing(hyperparams.mutationRate, stageProperties.adjustMutationUpPlateau / 10000, stageProperties.adjustMutationDownPlateau / 10000);
    hyperparams.layerMutationRate = adjustForPlateauing(hyperparams.layerMutationRate, stageProperties.adjustLayerMutationUpPlateau / 10000, stageProperties.adjustLayerMutationDownPlateau / 10000);
    hyperparams.nodeMutationRate = adjustForPlateauing(hyperparams.nodeMutationRate, stageProperties.adjustNodeMutationUpPlateau / 10000, stageProperties.adjustNodeMutationDownPlateau / 10000);

    // Other adjustments based on similarity to others
    hyperparams.limbMutationRate = roundRate(isBodySimilarToOthers(genome) ? hyperparams.limbMutationRate * (stageProperties.adjustLimbMutationUpSimilar / 10000) : hyperparams.limbMutationRate * (stageProperties.adjustLimbMutationDownSimilar / 10000));
    hyperparams.layerMutationRate = roundRate(isBrainLayersSimilarToOthers(genome) ? hyperparams.layerMutationRate * (stageProperties.adjustLayerMutationUpSimilar / 10000) : hyperparams.layerMutationRate * (stageProperties.adjustLayerMutationDownSimilar / 10000));
    hyperparams.nodeMutationRate = roundRate(isBrainNodesSimilarToOthers(genome) ? hyperparams.nodeMutationRate * (stageProperties.adjustNodeMutationUpSimilar / 10000) : hyperparams.nodeMutationRate * (stageProperties.adjustNodeMutationDownSimilar / 10000));

    return hyperparams;
}

// Function to find the average body plan of the group to update the body mutation rate
function getAverageBody(groupAgentsForAverage) {
    let mainBodySize = [];
    let totalLimbs = 0;
    let totalLimbSize = 0;
    let totalLimbDepth = 0;

    groupAgentsForAverage.forEach(agent => {
        mainBodySize.push(agent.genome.mainBody.size * agent.genome.mainBody.density);

        let flattenedLimbs = flattenLimbStructure(agent.genome.mainBody.arms);
        totalLimbs += flattenedLimbs.length;
        flattenedLimbs.forEach(limb => {
            totalLimbSize += limb.width * limb.length;
            totalLimbDepth += limb.numberInChain;
        });
    });

    let groupIndex = groupAgentsForAverage[0].genome.metadata.agentGroup;
    averageGroupBody[groupIndex] = {
        mainBodySize: mainBodySize.reduce((acc, size) => acc + size, 0) / mainBodySize.length,
        averageNumberOfLimbs: totalLimbs / groupAgentsForAverage.length,
        averageLimbSize: totalLimbSize / totalLimbs,
        averageLimbDepth: totalLimbDepth / totalLimbs
    };
}


// Function to find the average brain of the group to update the brain mutation rate.
function getAverageBrain(groupAgentsForAverage) {
    let totalAverageBrainNodesPerLayer = 0;
    let totalBrainLayers = 0;
    let totalWeights = [];
    let totalBiases = [];

    groupAgentsForAverage.forEach(agent => {
        let brainNodes = agent.genome.inputLayerGenes[0].numberOfNeurons + agent.genome.outputLayerGenes[0].numberOfNeurons;
        agent.genome.layerGenes.forEach(layer => {
            brainNodes += layer.numberOfNeurons;
            totalBrainLayers++;

            layer.weights.forEach(weightRow => {
                weightRow.forEach(weight => {
                    totalWeights.push(weight.value);
                });
            });

            layer.biases.forEach(bias => {
                totalBiases.push(bias.value);
            });
        });

        averageBrainNodesPerLayer = brainNodes / agent.genome.layerGenes.length + 2;
        totalAverageBrainNodesPerLayer += averageBrainNodesPerLayer;
    });

    let groupIndex = groupAgentsForAverage[0].genome.metadata.agentGroup;
    averageGroupBrainLayers[groupIndex] = totalBrainLayers / groupAgentsForAverage.length;
    averageGroupBrainNodes[groupIndex] = totalAverageBrainNodesPerLayer / groupAgentsForAverage.length;

    // Calculate average weights and biases
    let averageWeight = totalWeights.reduce((acc, val) => acc + val, 0) / totalWeights.length;
    let averageBias = totalBiases.reduce((acc, val) => acc + val, 0) / totalBiases.length;

    // Calculate average absolute deviation from the mean
    let averageWeightDeviation = totalWeights.map(val => Math.abs(val - averageWeight)).reduce((acc, val) => acc + val, 0) / totalWeights.length;
    let averageBiasDeviation = totalBiases.map(val => Math.abs(val - averageBias)).reduce((acc, val) => acc + val, 0) / totalBiases.length;

    averageGroupBrain[groupIndex] = {
        averageWeight: averageWeight,
        averageBias: averageBias,
        averageWeightDeviation: averageWeightDeviation,
        averageBiasDeviation: averageBiasDeviation
    };
}

// Calculate the average score of the group to update the mutation rate
function getAverageScore(groupAgentsForAverage) {
    let groupIndex = groupAgentsForAverage[0].genome.metadata.agentGroup;
    averageGroupScores[groupIndex] = groupAgentsForAverage.reduce((acc, agent) => acc + agent.Score, 0) / groupAgentsForAverage.length;
}

// Calculate how similar the different population groups are and update the migration rate to maintain diversity
function isBodySimilarToOthers(genome) {
    let group = genome.metadata.agentGroup;
    let averageBody = averageGroupBody[group];

    let flattenedLimbs = flattenLimbStructure(genome.mainBody.arms);
    let numberOfLimbs = flattenedLimbs.length;
    let totalLimbSize = flattenedLimbs.reduce((acc, limb) => acc + limb.width * limb.length, 0);
    let totalLimbDepth = flattenedLimbs.reduce((acc, limb) => acc + limb.numberInChain, 0);

    let averageLimbSize = numberOfLimbs > 0 ? totalLimbSize / numberOfLimbs : 0;
    let averageLimbDepth = numberOfLimbs > 0 ? totalLimbDepth / numberOfLimbs : 0;

    const sizeThreshold = 0.05; // Size is actually now mass
    const limbCountThreshold = 0.25;
    const limbSizeThreshold = 0.05;
    const limbDepthThreshold = 0.1;

    let isMainBodySizeSimilar, isLimbCountSimilar, isLimbSizeSimilar, isLimbAngleSimilar, isLimbDepthSimilar;
    try {
        isMainBodySizeSimilar = Math.abs((genome.mainBody.size * genome.mainBody.density) - averageBody.mainBodySize) / averageBody.mainBodySize <= sizeThreshold;
        isLimbCountSimilar = Math.abs(numberOfLimbs - averageBody.averageNumberOfLimbs) <= limbCountThreshold;
        isLimbSizeSimilar = averageLimbSize > 0 && Math.abs(averageLimbSize - averageBody.averageLimbSize) / averageBody.averageLimbSize <= limbSizeThreshold;
        isLimbDepthSimilar = Math.abs(averageLimbDepth - averageBody.averageLimbDepth) <= limbDepthThreshold;
    } catch (e) {
        console.log("Error in body similarity check. genome: ", genome);
    }

    let similarityCount = (isMainBodySizeSimilar ? 1 : 0) +
        (isLimbCountSimilar ? 1 : 0) +
        (isLimbSizeSimilar ? 1 : 0) +
        (isLimbAngleSimilar ? 1 : 0) +
        (isLimbDepthSimilar ? 1 : 0);

    return similarityCount >= 3;
}


function isBrainSimilarToOthers(genome) {
    const group = genome.metadata.agentGroup;
    const average = averageGroupBrain[group];

    let totalDeviation = 0;
    let count = 0;

    try {
        // Calculate deviation for weights
        genome.layerGenes.forEach(layer => {
            layer.weights.forEach(weightRow => {
                weightRow.forEach(weight => {
                    totalDeviation += Math.abs(weight.value - average.averageWeight);
                    count++;
                });
            });
        });

        // Calculate deviation for biases
        [genome.inputLayerGenes[0], ...genome.layerGenes, genome.outputLayerGenes[0]].forEach(layer => {
            layer.biases.forEach(bias => {
                totalDeviation += Math.abs(bias.value - average.averageBias);
                count++;
            });
        });

        const averageDeviation = totalDeviation / count;
        return averageDeviation < (average.averageWeightDeviation + average.averageBiasDeviation) / 5;
    } catch (e) {
        console.log("Error in brain similarity check. genome: ", genome);
        console.log("Group: ", group);
        console.log("Average Brain: ", average);
        console.log("averageGroupBrain: ", averageGroupBrain);

        return false;
    }
}


function isBrainLayersSimilarToOthers(genome) {
    const group = genome.metadata.agentGroup;
    const averageLayers = averageGroupBrainLayers[group];
    const agentLayers = genome.layerGenes.length;

    // Check if the number of layers in the agent's brain is close to the group average
    return Math.abs(agentLayers - averageLayers) <= 0.25;
}


function isBrainNodesSimilarToOthers(genome) {
    const group = genome.metadata.agentGroup;
    const averageNodes = averageGroupBrainNodes[group];
    let agentNodes = genome.inputLayerGenes[0].numberOfNeurons + genome.outputLayerGenes[0].numberOfNeurons;

    genome.layerGenes.forEach(layer => {
        agentNodes += layer.numberOfNeurons;
    });

    averageNodesPerLayer = agentNodes / genome.layerGenes.length + 2;

    // Check if the number of nodes in the agent's brain is close to the group average
    return Math.abs(averageNodesPerLayer - averageNodes) < 0.5;
}


function isScoreCloseToAverage(genome) {
    const groupIndex = genome.metadata.agentGroup;
    const agentScore = genome.Score;
    const averageScore = averageGroupScores[groupIndex];
    const thresholdPercentage = 0.25;

    // Calculate the absolute difference between the agent's score and the average score
    const scoreDifference = Math.abs(agentScore - averageScore);

    // Check if the difference is within the threshold percentage of the average score
    return scoreDifference <= (averageScore * thresholdPercentage);
}

function linearRegression(y, x) {
    let n = y.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < y.length; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += (x[i] * y[i]);
        sumXX += (x[i] * x[i]);
    }
    let slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    let intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

function isScorePlateauing(scoreHistory, isAgent = false) {
    if (scoreHistory.length < 2) return false; // Need at least 2 points to define a trend

    // Choose the appropriate mapping based on whether it's agent history or overall population history
    let y = isAgent ? scoreHistory.map(entry => entry.score) : scoreHistory;
    let x = scoreHistory.map((_, index) => index);

    let { slope, intercept } = linearRegression(y, x);
    let lastPoint = y[y.length - 1];
    let predictedLastPoint = slope * (x.length - 1) + intercept;

    return lastPoint < predictedLastPoint; // True if the actual score is below the predicted score
}


// Function to update the migration rate based on group differences
function adjustMigrationRateBasedOnGroupDifferences() {

    if (numGroups <= 1) return; // No adjustment needed for a single group

    // While differences is below the similarityThreshold, decrease the migration rate
    let similarityThreshold = stageProperties.similarityThresholdMigration / 10;
    // While differences is above the divergenceThreshold, increase the migration rate
    let divergenceThreshold = stageProperties.divergenceThresholddMigration / 10;

    // Calculate average differences between groups
    let differences = calculateGroupDifferences();
    // console.log("Differences: ", differences);

    // Assess if groups are becoming too similar or too divergent
    averageDifference = differences.reduce((acc, diff) => acc + diff, 0) / differences.length;
    let areGroupsSimilar = differences.length > 0 && averageDifference < similarityThreshold;
    let areGroupsDivergent = differences.length > 0 && averageDifference > divergenceThreshold;

    // Adjust migration rate accordingly
    if (areGroupsSimilar && stageProperties.migrationRate > 1 && differences.length > 0) {
        stageProperties.migrationRate -= 1; // Decrease by a small amount
        //console.log("Migration rate decreased to ", stageProperties.migrationRate);
        //console.log("Average differences: ", averageDifference);
    } else if (areGroupsDivergent && stageProperties.migrationRate < 1000 && differences.length > 0) {
        stageProperties.migrationRate += 1; // Increase by a small amount
        //console.log("Migration rate increased to ", stageProperties.migrationRate);
        //console.log("Average differences: ", averageDifference);
    } else {
        //console.log("Migration rate unchanged at ", stageProperties.migrationRate);
        //console.log("Average differences: ", averageDifference);
    }
}

// Helper function to calculate differences between groups
function calculateGroupDifferences() {

    let differences = [];
    for (let i = 0; i < numGroups - 1; i++) {
        for (let j = i + 1; j < numGroups; j++) {
            let diffScore = Math.abs(averageGroupScores[i] - averageGroupScores[j]);
            let diffBrain = Math.abs((averageGroupBrainLayers[i] * averageGroupBrainNodes[i]) - (averageGroupBrainLayers[j] * averageGroupBrainNodes[j]));
            let diffBody = Math.abs(averageGroupBody[i].averageNumberOfLimbs - averageGroupBody[j].averageNumberOfLimbs);
            let diffMass = Math.abs(averageGroupBody[i].mainBodySize - averageGroupBody[j].mainBodySize);
/*            console.log("Group ", i, " vs Group ", j, " Score: ", diffScore, " Brain: ", diffBrain, " Body: ", diffBody, " Mass: ", diffMass);*/
            let totalDiff;
            if (stageProperties.offspringLayerMutationRate !== 0) {
                totalDiff = ((diffScore / 100) + (diffBrain / 10) + (diffBody * 10) + (diffMass * 2)) / 4; // Average difference across score, brain, and body
            } else {
                totalDiff = ((diffScore / 100) + (diffBody * 10) + (diffMass * 2)) / 3; // Average difference across score and body
            }
            differences.push(totalDiff);
        }
    }
    return differences;
}


function generateUniqueId(usedIds) {
    let newId;
    do {
        newId = 1000 + Math.floor(Math.random() * 1000000);
    } while (usedIds.includes(newId));
    usedIds.push(newId);
    return newId;
}

// Function to mutate the brain of an agent.  Can mutate the weights and biases of the brain, and also add or remove nodes or layers.
function mutateGenome(genome, mutationRate, nodeMutationRate, layerMutationRate) {
    const stdDeviation = (stageProperties.neuronMutationStandardDeviation / 100);

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

    try {
        // Mutate Input Layer Biases
        mutateValues(genome.inputLayerGenes[0].biases);
    } catch (e) {
        console.log("Error mutating input layer biases. genome: ", genome);
    }

    try {
        // Mutate Hidden Layers Weights and Biases
        for (let i = 0; i < genome.layerGenes.length; i++) {
            for (let j = 0; j < genome.layerGenes[i].weights.length; j++) {
                mutateValues(genome.layerGenes[i].weights[j]);
            }
            mutateValues(genome.layerGenes[i].biases);
        }
    } catch (e) {
        console.log("Error mutating hidden layer weights and biases. genome: ", genome);
    }

    try {
        // Mutate Output Layer Weights and Biases
        for (let j = 0; j < genome.outputLayerGenes[0].weights.length; j++) {
            mutateValues(genome.outputLayerGenes[0].weights[j]);
        }
        mutateValues(genome.outputLayerGenes[0].biases);
    } catch (e) {
        console.log("Error mutating output layer weights and biases. genome: ", genome);
    }

    // Node mutation (add or remove node)
    if (Math.random() < nodeMutationRate) {
        let randomLayerIndex = Math.floor(Math.random() * genome.layerGenes.length);
        let randomLayer = genome.layerGenes[randomLayerIndex];
        let randomNodeIndex = Math.floor(Math.random() * (randomLayer.biases.length));

        // decide to add or remove a node with equal probability
        if (Math.random() < 0.5 || randomLayer.biases.length === 1) {
            try {
                // Add a node
                let newBiasId = generateUniqueId(genome.usedBiasIDs);
                randomLayer.biases.splice(randomNodeIndex, 0, { id: newBiasId, value: Math.random() });
                randomLayer.numberOfNeurons++;

                // genome.agentHistory.mutations.push("type: node, layer: " + randomLayerIndex + " id: " + newBiasId + " mutation: add");
                addMutationWithHistoryLimit(genome.agentHistory.mutations, "type: node, layer: " + randomLayerIndex + " id: " + newBiasId + " mutation: add");

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
            } catch (e) {
                console.log("Error adding node.  genome: ", genome);
            }

        } else {
            // Remove a node
            if (randomLayer.biases.length > 1) {

                try {
                    let removedBiasId = randomLayer.biases[randomNodeIndex].id;

                    // genome.agentHistory.mutations.push("type: node, layer: " + randomLayerIndex + " id: " + removedBiasId + " mutation: remove");
                    addMutationWithHistoryLimit(genome.agentHistory.mutations, "type: node, layer: " + randomLayerIndex + " id: " + removedBiasId + " mutation: remove");

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

                    // genome.agentHistory.mutations.push("type: node, layer: " + randomLayerIndex + " id: " + randomNodeIndex + "Not Found, skipping mutation");
                    addMutationWithHistoryLimit(genome.agentHistory.mutations, "type: node, layer: " + randomLayerIndex + " index: " + randomNodeIndex + " ID: " + removedBiasId + "Not Found, skipping mutation");
                }

            }
        }
    }

    // Layer mutation
    if (Math.random() < layerMutationRate) {
        if (Math.random() < 0.5) {
            try {
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

                // genome.agentHistory.mutations.push("type: layer, new layer after layer: " + randomLayerIndex + " mutation: add copy");
                addMutationWithHistoryLimit(genome.agentHistory.mutations, "type: layer, new layer after layer: " + randomLayerIndex + " mutation: add copy");
            } catch (e) {
                // console.log("Error adding layer.  genome: ", genome);
                addMutationWithHistoryLimit(genome.agentHistory.mutations, "type: layer, failed adding layer at index: " + randomLayerIndex);
            }

        } else {
            // Remove a layer
            if (genome.layerGenes.length > 2) {
                try {
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

                        // genome.agentHistory.mutations.push("type: layer, removed layer: " + randomLayerIndex + " mutation: remove");
                        addMutationWithHistoryLimit(genome.agentHistory.mutations, "type: layer, removed layer: " + randomLayerIndex + " mutation: remove");
                    }
                } catch (e) {
                    console.log("Error removing layer.  genome: ", genome);
                }

            } else {
                // genome.agentHistory.mutations.push("type: layer, no layer to remove, mutation: remove");
                addMutationWithHistoryLimit(genome.agentHistory.mutations, "type: layer, no layer to remove, mutation: remove");
            }
        }
    }

    return genome;
}

// Function to mutate the body plan of an agent.  Mutates each body part with a probability, and can add or remove limbs.
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
            limb.startingAngle = mutateWithinBounds(limb.startingAngle, 0, 2 * Math.PI, true);
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

    // Heartbeat Mutation
    if (Math.random() < bodyMutationRate && childGenome.hyperparameters.heartbeat) {
        let originalHeartbeat = childGenome.hyperparameters.heartbeat;
        let mutatedHeartbeat = mutateWithinBounds(originalHeartbeat, 1, 100);

        // If mutated value is different, adjust by 1 towards the direction of the mutation
        if (mutatedHeartbeat !== originalHeartbeat) {
            let adjustmentDirection = Math.sign(mutatedHeartbeat - originalHeartbeat);
            childGenome.hyperparameters.heartbeat += adjustmentDirection;
        }
    }

    // Limb Properties Mutation
    childGenome.mainBody.arms.forEach(mutateLimb);

    // Limb Number Mutation, half as often as other body mutations
    // My current setup just randomly decides to add or remove a limb, and randomly decides where.  Closer to evolution would be if I gave each limb a chance to have a number of actions occur, such as growing a new limb, altering its own properties, or removing itself.
    if (Math.random() < bodyMutationRate / 2) { // normally divided by 2 but increase chance for testing
        if (Math.random() < 0.5) {
            try {
                let totalLimbs = countArms(childGenome.mainBody.arms);
                let newLimbID = totalLimbs + 100;
                let angle = Math.random() * 2 * Math.PI; // Random angle for the new limb
                let flattenedLimbs = flattenLimbStructure(childGenome.mainBody.arms);

                let selectedPart = selectRandomBodyPart(childGenome.mainBody);
                let closestLimb = findClosestLimbForWeights(flattenedLimbs, angle);

                let newLimb = createNewLimb(angle, selectedPart, newLimbID);

                if (closestLimb == null) {
                    closestLimb = childGenome.mainBody.arms[0];
                    console.error("No closest limb found for new limb, correcting with limb 0. Genome: ", childGenome);
                    console.error("Selected Part: ", selectedPart);
                    console.error("Angle : ", angle);
                    addMutationWithHistoryLimit(childGenome.agentHistory.mutations, "type: limb, id: " + newLimb.partID + " mutation: add, " + "Closest limb not found, using idx 0, ID: " + closestLimb.partID + " Number In Chain: " + newLimb.numberInChain);
                } else {
                    addMutationWithHistoryLimit(childGenome.agentHistory.mutations, "type: limb, id: " + newLimb.partID + " mutation: add, " + "Copied weights from limb: " + closestLimb.partID + " Number In Chain: " + newLimb.numberInChain);
                }

                addChildLimbToPart(selectedPart, newLimb);
                let newFlattenedLimbs = flattenLimbStructure(childGenome.mainBody.arms);

                // let inputNodeIndex;
                let inputNodeIndex = newFlattenedLimbs.findIndex(part => part.partID === newLimbID);
                let closestLimbInputNodeIdx = flattenedLimbs.findIndex(part => part.partID === closestLimb.partID);
                let closestLimbInputNodeID = childGenome.inputLayerGenes[0].biases[closestLimbInputNodeIdx].id;

                // Add a new node to the input layer for the limb
                let inputNodeId = generateUniqueId(childGenome.usedBiasIDs);  // Generate a unique ID for this node

                try {
                    childGenome.inputLayerGenes[0].biases.splice(inputNodeIndex, 0, { id: inputNodeId, value: Math.random() }); // Random value for the bias for now
                    childGenome.inputLayerGenes[0].numberOfNeurons++;
                    childGenome.inputLayerGenes[0].inputs.push(childGenome.inputLayerGenes[0].inputs.length);
                } catch (e) {
                    console.log("Error adding input bias for new limb.  inputNodeIndex: ", inputNodeIndex);
                    throw e;
                }
                // Add a new node to the output layer for the limb
                let outputNodeID = generateUniqueId(childGenome.usedBiasIDs);
                let oldOutputNodeID;
                try {
                    oldOutputNodeID = childGenome.outputLayerGenes[0].biases[closestLimbInputNodeIdx].id;
                    childGenome.outputLayerGenes[0].biases.splice(inputNodeIndex, 0, { id: outputNodeID, value: Math.random() });
                    childGenome.outputLayerGenes[0].numberOfNeurons++;
                } catch (e) {
                    console.log("Error adding output bias for new limb.  outputNodeID: ", outputNodeID);
                    console.log("closestLimbInputNodeIdx: ", closestLimbInputNodeIdx);
                    console.log("inputNodeIndex: ", inputNodeIndex);
                    throw e;
                }
                // Add new weights associated with the new nodes
                // For the input layer, link weights from the new input node to all nodes in the first hidden layer
                let firstHiddenLayer = childGenome.layerGenes[0];
                let lastHiddenLayer = childGenome.layerGenes[childGenome.layerGenes.length - 1];
                // Use the weights from the closest limb for the new limb, if a closest limb is found
                if (closestLimb) {
                    let closestLimbInputWeights;
                    let closestLimbOutputWeights;
                    try {
                        // get the weight array where the fromNodeID is the closest limb's partID
                        closestLimbInputWeights = firstHiddenLayer.weights.find(weightArray => weightArray[0].fromNodeID === closestLimbInputNodeID);

                        // find the weight in each weight array where the toNodeID is the closest limb's partID
                        closestLimbOutputWeights = childGenome.outputLayerGenes[0].weights.map(weightsArray => weightsArray.find(weight => weight.toNodeID === oldOutputNodeID));
                    } catch (e) {
                        console.log("Error adding weights for new limb.  closestLimbInputNodeID: ", closestLimbInputNodeID);
                        console.log("oldOutputNodeID: ", oldOutputNodeID);
                        throw e;
                    }
                    firstHiddenLayer.weights.splice(inputNodeIndex, 0, closestLimbInputWeights.map(weight => ({
                        ...weight,
                        fromNodeID: inputNodeId
                    })));

                    lastHiddenLayer.biases.forEach((bias, idx) => {
                        try {
                            childGenome.outputLayerGenes[0].weights[idx].splice(inputNodeIndex, 0, {
                                value: closestLimbOutputWeights[idx].value,
                                toNodeID: outputNodeID,
                                fromNodeID: bias.id
                            });
                        } catch (e) {
                            console.log("Error adding weights to output layer.");
                            console.log("Output Node Index: ", inputNodeIndex, "lastHiddenLayer bias idx", idx);
                            console.log("closestLimbOutputWeights", closestLimbOutputWeights);
                            throw e;
                        }
                    });

                } else {
                    throw new Error("No closest limb found for new limb");
                }

                updateLimbIDs(childGenome);

            } catch (e) {
                console.log("Error adding limb.  genome: ", childGenome);
                console.log("Error : ", e);
            }

        } else {
            if (childGenome.mainBody.arms.length > 1) {
                try {
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
                        // childGenome.agentHistory.mutations.push(`type: ${limbToRemove.numberInChain === 1 ? 'limb' : 'sublimb'}, id: ${limbToRemove.partID}, index: ${flattenedIndex}, mutation: remove`);
                        addMutationWithHistoryLimit(childGenome.agentHistory.mutations, `type: ${limbToRemove.numberInChain === 1 ? 'limb' : 'sublimb'}, id: ${limbToRemove.partID}, index: ${flattenedIndex}, mutation: remove`);

                        updateLimbIDs(childGenome);

                        try {
                            // Remove node from the input layer
                            let nodeToRemoveID = childGenome.inputLayerGenes[0].biases[flattenedIndex].id;
                            childGenome.inputLayerGenes[0].biases.splice(flattenedIndex, 1);
                            childGenome.inputLayerGenes[0].numberOfNeurons--;
                            childGenome.inputLayerGenes[0].inputs.splice(flattenedIndex, 1);

                            // Remove weights connected to the removed input node from the first hidden layer
                            childGenome.layerGenes[0].weights = childGenome.layerGenes[0].weights.filter(weightArray => weightArray[0].fromNodeID !== nodeToRemoveID);

                            // Remove node from the output layer
                            let outputNodeToRemoveID = childGenome.outputLayerGenes[0].biases[flattenedIndex].id;
                            childGenome.outputLayerGenes[0].biases.splice(flattenedIndex, 1);
                            childGenome.outputLayerGenes[0].numberOfNeurons--;

                            // Remove weights connected to the removed output node
                            for (let i = 0; i < childGenome.outputLayerGenes[0].weights.length; i++) {
                                childGenome.outputLayerGenes[0].weights[i] = childGenome.outputLayerGenes[0].weights[i].filter(weight => weight.toNodeID !== outputNodeToRemoveID);
                            }
                        } catch (e) {
                            console.log("Error removing node.  flattenedIndex: ", flattenedIndex);
                            console.log("Output Layer: ", childGenome.outputLayerGenes[0]);
                            throw e;
                        }
                    }
                } catch (e) {
                    console.log("Error removing limb.  genome: ", childGenome);
                    console.log("Error: ", e);
                }
            }
        }
    }


    return childGenome;
}

// Function attempts to re-build the bias ids and weight fromNodeIDs and toNodeIDs after crossover and mutation.  This removes some ability to track mutations
function resetNeuralNetworkIDs(genome) {
    let currentID = 0;
    let idMapping = {};

    // Function to add mutation history with specific format, only if significant change.  Trying to avoid logging the sequential resultant changes after the first value is updated.
    const ID_CHANGE_THRESHOLD = 3; 
    function logIdRemapping(oldID, newID) {
        if (Math.abs(oldID - newID) > ID_CHANGE_THRESHOLD) {
            // addMutationWithHistoryLimit(genome.agentHistory.mutations, "Genome cleanup remapped bias id: " + oldID + " To new id: " + newID);
        }
    }

    try {

        try {
            // Process for input layer
            genome.inputLayerGenes[0].biases.forEach(bias => {
                idMapping[bias.id] = currentID;
                if (bias.id !== currentID) {
                    logIdRemapping(bias.id, currentID);
                }
                bias.id = currentID++;
            });
        } catch (e) {
            console.log("Error updating input layer.  Current ID: ", currentID);
            throw e;
        }

        try {
            // Process for hidden layers
            genome.layerGenes.forEach(layer => {
                layer.biases.forEach(bias => {
                    idMapping[bias.id] = currentID;
                    if (bias.id !== currentID) {
                        logIdRemapping(bias.id, currentID);
                    }
                    bias.id = currentID++;
                });

                layer.weights.forEach(weightRow => {
                    weightRow.forEach(weight => {
                        weight.fromNodeID = idMapping[weight.fromNodeID];
                        weight.toNodeID = idMapping[weight.toNodeID];
                    });
                });
            });
        } catch (e) {
            console.log("Error updating weights in hidden layers.  Current ID: ", currentID);
            throw e;
        }

        try {
            // Process for output layer
            let outputLayer = genome.outputLayerGenes[0];
            outputLayer.biases.forEach(bias => {
                idMapping[bias.id] = currentID;
                if (bias.id !== currentID) {
                    logIdRemapping(bias.id, currentID);
                }
                bias.id = currentID++;
            });

            // Update fromNodeID for the weights in the output layer
            outputLayer.weights.forEach(weightRow => {
                weightRow.forEach(weight => {
                    weight.fromNodeID = idMapping[weight.fromNodeID];
                    weight.toNodeID = idMapping[weight.toNodeID];
                });
            });
        } catch (e) {
            console.log("Error updating weights in output layer.   Current ID: ", currentID);
            throw e;
        }

    } catch (e) {
        console.log("Genome: ", genome);
        console.error("Error resetting neural network IDs.  Error: ", e);
    }
}


// Helper function to count the number of limbs in a genome
function countArms(armsToCount) {
    let totalArmNo = 0;

    if (!armsToCount) return 0;

    for (let arm of armsToCount) {
        totalArmNo++; // Count the current arm
        totalArmNo += countArms(arm.subArms); // Count sub-arms recursively
    }

    return totalArmNo;
}

// Helper function to select a random limb from the genome
function selectRandomBodyPart(mainBody) {
    // Flatten the structure of limbs into a single array
    let allParts = flattenLimbStructure(mainBody.arms, mainBody);
    let randomIndex = Math.floor(Math.random() * allParts.length);
    return allParts[randomIndex];
}

// Helper function to flatten the limb structure into a single array
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

// Helper function to add a mutation to the history array, and trim the array to the last x records
function addMutationWithHistoryLimit(mutationArray, mutationRecord) {

    // Ensure the mutations array exists
    if (!mutationArray) {
        mutationArray = [];
    }

    // Add the new mutation record
    mutationArray.push(mutationRecord + " Gen Count: " + stageProperties.genCount);

    // Trim the mutations history to the last x records if it's longer
    while (mutationArray.length > 50) {
        mutationArray.shift(); // Remove the oldest record
    }

}

// Helper function to find the closest limb to the new random angle picked for a mutated limb
function findClosestLimbForWeights(arms, targetAngle) {
    let closestLimb = null;

    for (let arm of arms) {
        let currentAngleDiff = angleDifference(arm.startingAngle, targetAngle);
        let closestAngleDiff = closestLimb ? angleDifference(closestLimb.startingAngle, targetAngle) : Infinity;

        if (currentAngleDiff < closestAngleDiff) {
            closestLimb = arm;
        }

    }

    return closestLimb;
}

// Helper function to calculate the shortest angle difference
function angleDifference(angle1, angle2) {
    const twoPi = Math.PI * 2;
    let diff = Math.abs(angle1 - angle2) % twoPi;
    if (diff > Math.PI) {
        diff = twoPi - diff;
    }
    return diff;
}

// Helper function to create a new limb for mutation
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
            maxAngle: Math.PI / (2 + Math.floor(Math.random() * 4)),
            minAngle: -Math.PI / (2 + Math.floor(Math.random() * 4))
        },
        length: 10 + Math.floor(Math.random() * 50),
        width: 2 + Math.floor(Math.random() * 20),
        shape: "rectangle",
        subArms: [],
        numberInChain: selectedPart.numberInChain + 1,
        parentPartID: selectedPart.partID,
        type: "Arm",
    };
}

// Helper function to add a limb to a body part
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

// Used to update the partID of each limb after a mutation
function updateLimbIDs(genome) {
    // Flatten the limb structure to easily update IDs
    let flattenedLimbs = flattenLimbStructure(genome.mainBody.arms);

    // Function to log significant ID changes
    const ID_CHANGE_THRESHOLD = 3;
    function logLimbIdChange(oldID, newID) {
        if (Math.abs(oldID - newID) > ID_CHANGE_THRESHOLD) {
            // addMutationWithHistoryLimit(genome.agentHistory.mutations, "Limb ID updated from: " + oldID + " to: " + newID);
        }
    }

    // Update the partID for each limb based on its position in the flattened array
    for (let i = 0; i < flattenedLimbs.length; i++) {
        let currentLimb = flattenedLimbs[i];
        if (currentLimb.partID !== i + 1) {
            logLimbIdChange(currentLimb.partID, i + 1);
        }
        currentLimb.partID = i + 1;  // +1 because main body is limb 0

        for (let subLimb of currentLimb.subArms) {
            if (subLimb.parentPartID !== currentLimb.partID) {
                logLimbIdChange(subLimb.parentPartID, currentLimb.partID);
            }
            subLimb.parentPartID = currentLimb.partID;
        }
    }
}


// Helper function to mutate a value within a range, and optionally wrap around
function mutateWithinBounds(original, min, max, wrapAround = false) {
    const stdDeviation = (stageProperties.bodyPlanMutationStandardDeviation / 100);
    let adjustment = randomGaussian(0, stdDeviation);

    function randomGaussian(mean, sd) {
        let u1 = Math.random();
        let u2 = Math.random();
        let randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
        return mean + sd * randStdNormal;
    }

    // Mutate value
    let mutated = original + ((Math.random() - 0.5) * adjustment * (max - min));

    if (wrapAround) {
        // Wrap around logic
        if (mutated > max) {
            return min + (mutated - max);
        } else if (mutated < min) {
            return max - (min - mutated);
        }
    } else {
        // Clamp to min/max
        mutated = Math.min(max, Math.max(min, mutated));
    }

    return mutated;
}


/***   Agent Prototype Functions   ***/

// Helper function to convert coordinates to a map key.  Could be standalone function but I'm keeping it here for now.
AgentNEAT.prototype.getCoordinateKey = function (x, y) {
    return `${x},${y}`;
};

// Function duplicates the agents limbs conditionally based on symmetry
AgentNEAT.prototype.duplicateLimbsForSymmetry = function () {
    this.noLimbsBeforeDupe = this.bodyParts.length;

    // Find the maximum limb ID in the original set
    const maxPartID = Math.max(...this.bodyParts.map(limb => limb.partID));

    // Create a copy of the original limbs to avoid modifying the array while iterating.  This is working but some parts need a review, such as the noFrontLimbs value.
    const originalLimbs = this.bodyParts.slice();
    let insertIndex = 0;
    for (let i = 0; i < originalLimbs.length; i++) {
        let originalLimb = originalLimbs[i];
        insertIndex++;

        const epsilon = 0.1;
        const Pi = Math.PI;
        const twoPi = 2 * Math.PI;

        // Only duplicate limbs that are not within a small range of the front or back of the agent 
        if (!(((originalLimb.startingAngle >= 0 && originalLimb.startingAngle <= epsilon) ||
            (originalLimb.startingAngle >= Pi - epsilon && originalLimb.startingAngle <= Pi + epsilon) ||
            (originalLimb.startingAngle >= twoPi - epsilon && originalLimb.startingAngle <= twoPi)) && originalLimb.numberInChain == 1)) {

            if (originalLimb.partID == 1) {
                this.noFrontLimbs = 2;
            }

            let newLimb = _.cloneDeep(originalLimb);
            newLimb.startingAngle = (2 * Math.PI) - originalLimb.startingAngle;

            newLimb.constraints.minAngle = -originalLimb.constraints.maxAngle;
            newLimb.constraints.maxAngle = -originalLimb.constraints.minAngle;

            newLimb.duplicate = true;

            newLimb.partID = maxPartID + originalLimb.partID + 1;
            if (originalLimb.parentPartID != 0) {
                let parentLimb = this.bodyParts.find(limb => limb.partID === originalLimb.parentPartID);
                if (((parentLimb.startingAngle >= 0 && parentLimb.startingAngle <= epsilon) ||
                    (parentLimb.startingAngle >= Pi - epsilon && parentLimb.startingAngle <= Pi + epsilon) ||
                    (parentLimb.startingAngle >= twoPi - epsilon && parentLimb.startingAngle <= twoPi)) && parentLimb.numberInChain == 1) {
                    newLimb.parentPartID = originalLimb.parentPartID;
                } else {
                    newLimb.parentPartID = maxPartID + originalLimb.parentPartID + 1;
                }
            }

            // Update inputs for the neural network
            // this.genome.inputLayerGenes[0].numberOfNeurons++;
            // this.genome.inputLayerGenes[0].inputs.push(this.genome.inputLayerGenes[0].inputs.length);

            this.bodyParts.splice(insertIndex, 0, newLimb);
            insertIndex++;
        } else {
            this.noFrontLimbs = 1;
        }
    }
};

// Function to build the agent's body from its genome
AgentNEAT.prototype.buildBodyFromLimbStructure = function () {
    for (let part of this.bodyParts) {
        let parentLimb;
        let parentLimbLength = 0;
        let parentLimbGenome;

        try {
            if (part.numberInChain === 1) {
                parentLimb = this.mainBody;
                parentLimbLength = this.mainBodyRadius;
            } else if (part.numberInChain > 1 && part.parentPartID != 0) {
                parentLimb = this.limbs.find(limb => limb.getUserData() === part.parentPartID);
                parentLimbGenome = this.bodyParts.find(limb => limb.partID === part.parentPartID);
                parentLimbLength = parentLimbGenome.length;
            } else {
                console.log("Error in arm initialization, number in chain does not match.  BodyParts: " + JSON.stringify(this.bodyParts) + " Offending Limb: " + JSON.stringify(part));
            }
        } catch (err) {
            console.log("'Try Error: " + err + "' Error in arm initialization, number in chain does not match.  BodyParts: " + JSON.stringify(this.bodyParts) + " Offending Limb: " + JSON.stringify(part));
        }

        // This is how I can add different limb types later
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
                offsetFromMainLimb = this.mainBodyRadius + part.length / 2;
                part.attachment = { x: this.mainBodyRadius * Math.cos(angle), y: -this.mainBodyRadius * Math.sin(angle) };
                part.limbX = this.startingX + offsetFromMainLimb * Math.cos(angle - this.randomAngle);
                part.limbY = this.startingY - offsetFromMainLimb * Math.sin(angle - this.randomAngle);
            } else if (part.numberInChain > 1) {
                // Parent limb is another limb
                offsetFromMainLimb = parentLimbLength / 2 + part.length / 2;
                part.attachment = { x: 0, y: parentLimbLength / 2 };
                part.limbX = parentLimbGenome.limbX + offsetFromMainLimb * Math.cos(angle - this.randomAngle);
                part.limbY = parentLimbGenome.limbY - offsetFromMainLimb * Math.sin(angle - this.randomAngle);
            }

            let arm = createLimbNEAT(world, part.limbX, part.limbY, part.length, part.width, angle - this.randomAngle, part.partID);

            let localAnchorA;
            localAnchorA = planck.Vec2(
                part.attachment.x,
                part.attachment.y
            );

            // Calculate the point after rotation
            let localAnchorB = planck.Vec2(0, -part.length / 2);

            let joint = createRevoluteJointNEAT(world, parentLimb, arm, localAnchorA, localAnchorB, part.constraints.minAngle, part.constraints.maxAngle, part.constraints.maxTorque);

            if (part.duplicate) {
                joint.duplicate = true;
            }

            this.joints.push(joint);

            // body segment constructor
            this.limbs.push(arm);
            this.limbMass.push(arm.getMass());

            this.biases.push(1);
        }
        // else if (part.type == "Wing") {
        //      body segment constructor
        //      this.wings.push(wing);
        //      this.limbs.push(wing);
        //      this.limbMass.push(wing.getMass());
        // else if (part.type == "Thruster") {
        // ... other constructors

    }
};

// Helper function to create the main body of the agent
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

// Helper function to create a limb body
function createLimbNEAT(world, x, y, length, width, angle, limbNo) {

    angle += Math.PI / 2;

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

// Helper function to create a revolute joint between two bodies.
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

// Function to calculate the agents score
AgentNEAT.prototype.getScore = function (roundOver) {

    if (this.position.x > this.furthestXPos) {
        this.furthestXPos = this.position.x;
    }
    if (this.position.y < this.furthestYPos) {  // North is negative Y
        this.furthestYPos = this.position.y;
    }

    // If the agent has made new progress in the x or y direction, update the furthest position.
    let XPosScore = Math.floor(this.furthestXPos - this.startingX) * (stageProperties.xScoreMultiplier / 10);
    let YPosScore = Math.floor(this.startingY - this.furthestYPos) * (stageProperties.yScoreMultiplier / 10);

    let jointMovementReward = 0;
    if ((stageProperties.movementScoreMultiplier / 10) > 0) {
        jointMovementReward = (this.getJointMovementReward() * 15 / (this.numLimbs / 2)) * (stageProperties.movementScoreMultiplier / 10); // Bit of a mess, but its trying to give a slight bonus for having more limbs without overriding the score for travel.
    }

    if (this.limbs.length > 2) {
        jointMovementReward = jointMovementReward / (this.limbs.length - 2);
    }

    let explorationReward = 0;

    if ((stageProperties.explorationScoreMultiplier / 10) > 0) {
        explorationReward = this.getExplorationReward() * (stageProperties.explorationScoreMultiplier / 10);
    }

    // This gives a score penalty for the weight of the agents brain.  It can help with over-fitting and encourage smaller brains, but needs some tuning to not just destroy brains over time.
    let weightPenalty;
    //if (roundOver) {
    //    weightPenalty = this.getWeightPenalty() * 50;
    //} else {
    weightPenalty = 0;
    //}

    if (!roundOver && this.massBonus < 10 && (stageProperties.sizeScoreMultiplier / 100) > 0) {
        try {
            this.massBonus = this.mainBody.getMass() * (stageProperties.sizeScoreMultiplier / 100);
            // loop through limbs and add their mass to the massBonus
            for (let i = 0; i < this.limbs.length; i++) {
                this.massBonus += this.limbs[i].getMass() * (stageProperties.sizeScoreMultiplier / 200);
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

    if (this.Score > this.genome.metadata.bestScore) {
        this.genome.metadata.bestScore = this.Score;
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

// Function to calculate the weight of an agents brain.  Not in use and moving to the end of gen ranking function instead.
AgentNEAT.prototype.getWeightPenalty = function () {
    this.weightPenaltyCounter++;
    let allWeightTensors = this.brain.getWeights().filter((_, idx) => idx % 2 === 0);
    let allWeights = allWeightTensors.flatMap(tensor => Array.from(tensor.dataSync()).map(Math.abs)); // map to absolute values
    let averageAbsWeight = allWeights.reduce((sum, weight) => sum + weight, 0) / allWeights.length;

    this.weightPenaltyCache = averageAbsWeight;

    return this.weightPenaltyCache;
}

// Function to calculate the agents score bonus from moving limbs
AgentNEAT.prototype.getJointMovementReward = function () {
    let totalChange = 0;
    for (let i = 0; i < this.joints.length; i++) {
        let currentAngle = this.joints[i].getJointAngle();

        // Now that I randomly change the agent's starting angles, we need to only increment score after round starts
        if (stabilised || !stageProperties.agentsRequireStablising) {
            let change = Math.abs(currentAngle - this.previousJointAngles[i]) * (this.limbs[i].getMass() / stageProperties.jointMovementRewardLimbMassDivider);
            totalChange += change;
        }

        // Update the previous angle for next time
        this.previousJointAngles[i] = currentAngle;
    }

    // Exponential decay for the reward. You can adjust the decay factor as needed.
    let decayFactor = 0.75;

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

// Function to calculate the agents score bonus from exploration
AgentNEAT.prototype.getExplorationReward = function () {
    let gridX = Math.floor(((this.position.x - this.startingX) + 10) / stageProperties.internalMapCellSize) + 5;
    let gridY = Math.floor(((this.startingY - this.position.y) + 10) / stageProperties.internalMapCellSize) + 5;
    let key = this.getCoordinateKey(gridX, gridY);

    if (gridX >= 0 && gridX < stageProperties.internalMapSize && gridY >= 0 && gridY < stageProperties.internalMapSize) {
        if (!this.internalMap.has(key)) {
            this.internalMap.add(key);
            this.coveredCellCount++;
        }
    }

    return this.coveredCellCount;
};

// Function to render the agent
AgentNEAT.prototype.render = function (p, offsetX, offsetY) {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    // Set the fill color based on group
    p.fill(GROUP_COLORS[this.genome.metadata.agentGroup]);
    p.stroke(0);
    // Render the main body
    if (this.mainBody) {
        let mainPos = this.position;
        let mainAngle = this.mainBody.getAngle();
        let arrowLength = this.mainBodyRadius / 2; // Or any length you prefer
        let arrowBase = this.mainBodyRadius / 4;   // The size of the base of the arrow triangle

        p.push();
        p.translate(mainPos.x + offsetX, mainPos.y + offsetY);  // Added offsetX
        p.rotate(mainAngle);

        // Draw the main body
        p.ellipse(0, 0, this.mainBodyRadius * 2, this.mainBodyRadius * 2);

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

        if (stageProperties.showAgentNames === true) {
            // Draw the agent's name
            p.push();
            p.translate(mainPos.x + offsetX, mainPos.y + offsetY);  // Added offsetX
            p.textAlign(p.CENTER, p.TOP);
            p.textSize(18);
            p.fill(0);
            p.text(this.genome.metadata.agentName, 0, this.mainBodyRadius + 5);
            p.pop();
        }
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

// Function to render the forces applied to the agents if enabled
AgentNEAT.prototype.drawForceVectors = function (p, forceApplyPointX, forceApplyPointY, force, forceAngle) {
    if (this.currentlyLeading == true && stageProperties.showForceVectors == true) { // randomlySelectedAgents.includes(this) || leadingAgents.includes(this) && 

        const forceScale = stageProperties.visualForceScale; // Scale factor for force vector
        const maxForceLength = stageProperties.visualMaxForceLength; // Maximum length for visualized force vector

        // Scale the force for visualization
        force.setMag((force.mag() * forceScale));

        // Cap the length of the scaled force
        if (force.mag() > maxForceLength) {
            force.setMag(maxForceLength);
        }

        p.push();
        p.stroke(255);
        p.strokeWeight(2);
        p.line(forceApplyPointX + this.offsetX, forceApplyPointY + this.offsetY, forceApplyPointX + force.x + this.offsetX, forceApplyPointY + force.y + this.offsetY);
        p.pop();

        // Draw an arrow at the end of the line
        p.push();
        p.fill(255);
        p.translate(forceApplyPointX + force.x + this.offsetX, forceApplyPointY + force.y + this.offsetY);
        p.rotate(forceAngle);
        p.triangle(-10, -10, 0, 0, -10, 10);
        p.pop();
    }
}

// Function to render the agents vision lines if enabled
AgentNEAT.prototype.renderRayCasts = function (p, offsetX, offsetY) {
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

// Helper function to fix the output of the neural network to be either -1, 0, or 1
function alterOutputForSimplicity(output) {
    if (stageProperties.bodyPlanStart === "simple") {

        // If the simple body plan is enabled, the first output should be unmodified for control, with a small dead-zone to allow no steering
        let firstOutput = output[0];
        if (firstOutput > -0.5 && firstOutput < 0.5) {
            firstOutput = 0;
        }

        let remainingOutputs = output.slice(1);
        remainingOutputs = remainingOutputs.map(x => {
            if (x < 0) return -1;
            else return 1;
        });
        output = [firstOutput, ...remainingOutputs];
    } else {
        output = output.map(x => {
            if (x < -0.05) return -1;
            else if (x > 0.05) return 1;
            else return 0;
        });
    }

    return output;
}

// Function to make the agent's decision based on the neural network output
AgentNEAT.prototype.makeDecisionNEAT = function (inputs) {

    let output;
    try {
        output = this.brain.predict(tf.tensor([inputs])).dataSync();
    } catch (e) {
        console.error("Error in makeDecisionNEAT: " + e);
        console.log("Inputs: " + inputs);
        console.log("Genome: ", this.genome)
    }

    if (stageProperties.networkOutput === "simple") {
        output = alterOutputForSimplicity(output);
    }

    let outputIndex = 0;

    for (let i = 0; i < this.joints.length; i++) {

        if (stageProperties.outputsJointSpeed) {

            let adjustment = output[outputIndex] * (stageProperties.maxJointSpeed / 10) * Math.min(1, Math.max(0, (this.agentEnergy / this.startingEnergy)));

            this.joints[i].setMotorSpeed(adjustment);

            outputIndex++;
        }

        if (stageProperties.outputsJointTorque) {
            let adjustment = output[outputIndex] * stageProperties.maxTorqueMultiplier + 500000;
            this.joints[i].setMaxMotorTorque(adjustment);
            outputIndex++;
        }

        if (stageProperties.outputsBias) {
            // Adjusting the bias calculation to map [-1, 1] to [0, 2]
            let adjustment = output[outputIndex] + 1.01;
            this.biases[i] = adjustment;
            outputIndex++;
        }
    }
};

// Simplified version of the above function for symmetrical agents
AgentNEAT.prototype.makeDecisionSymmetricalNEAT = function (inputs) {

    let output = this.brain.predict(tf.tensor([inputs])).dataSync();

    if (stageProperties.networkOutput === "simple") {
        output = alterOutputForSimplicity(output);
    }

    let outputIndex = 0;

    // Apply first output to limb 0 and its duplicate (if exists)
    let firstAdjustment = output[outputIndex] * (stageProperties.maxJointSpeed / 10) * Math.min(1, Math.max(0, (this.agentEnergy / this.startingEnergy)));
    this.joints[0].setMotorSpeed(firstAdjustment);
    outputIndex++;
    if (stageProperties.outputsBias) {
        this.biases[0] = output[this.joints.length] + 1.01;
        outputIndex++;
    }

    if (this.noFrontLimbs == 2) {
        this.joints[1].setMotorSpeed(-firstAdjustment);
        if (stageProperties.outputsBias) {
            this.biases[1] = output[this.joints.length + 1] + 1.01;
            outputIndex++;
        }
    }

    for (let i = this.noFrontLimbs; i < this.joints.length; i += 2) {
        if (stageProperties.outputsJointSpeed) {
            let adjustment = output[outputIndex] * (stageProperties.maxJointSpeed / 10) * Math.min(1, Math.max(0, (this.agentEnergy / this.startingEnergy)));
            this.joints[i].setMotorSpeed(adjustment);
            this.joints[i + 1].setMotorSpeed(-adjustment);
            outputIndex++;
        }

        if (stageProperties.outputsJointTorque) {
            let adjustment = output[outputIndex] * stageProperties.maxTorqueMultiplier + 500000;
            this.joints[i].setMaxMotorTorque(adjustment);
            outputIndex++;
        }

        if (stageProperties.outputsBias) {
            // Adjusting the bias calculation to map [-1, 1] to [0, 2]
            let adjustment = output[outputIndex] + 1.01;
            this.biases[i] = adjustment;
            this.biases[i + 1] = adjustment;
            outputIndex++;
        }
    }
};

// Function to collect the inputs for the neural network.  Called before every call of makeDecision.
AgentNEAT.prototype.collectInputsNEAT = function () {
    this.inputs = [];

    // Constants for normalization
    const MAX_X = stageProperties.maxPosForNormalisation;
    const MAX_Y = stageProperties.maxPosForNormalisation;
    const MAX_VX = stageProperties.maxVelForNormalisation;
    const MAX_VY = stageProperties.maxVelForNormalisation;
    const MAX_SPEED = stageProperties.maxJointSpeed / 10; 
    const MAX_SCORE = stageProperties.topScoreEver;  // Max Score equaling the top score makes sense, but means the range of this input will change over the simulation.
    const MAX_TIME = stageProperties.simulationLength;

    if (stageProperties.inputJointAngle) {
        // 1. Joint angles normalized to [-1, 1]
        for (let joint of this.joints) {
            if (!joint.duplicate) {
                let jointAngle = joint.getJointAngle() / Math.PI;
                this.inputs.push(jointAngle);
            }
        }
    }

    if (stageProperties.inputJointSpeed) {
        // 2. Joint speeds normalized based on stageProperties.maxJointSpeed.  Temporally removed for simplicity
        for (let joint of this.joints) {
            let jointSpeed = joint.getJointSpeed() / MAX_SPEED;
            this.inputs.push(jointSpeed);
        }
    }

    let position = this.position;
    if (stageProperties.inputAgentPos) {
        // 3. Agent's position (x,y) normalized based on assumed max values
        this.inputs.push((position.x - this.startingX) / MAX_X);
        this.inputs.push(-1 * (position.y - this.startingY) / MAX_Y);
    }

    let velocity = this.mainBody.getLinearVelocity();
    if (stageProperties.inputAgentV) {
        // 4. Agent's velocity (x,y) normalized based on assumed max values for now
        this.inputs.push(velocity.x / MAX_VX);  // You may want to use a different max speed value here
        this.inputs.push(velocity.y / MAX_VY);  // You may want to use a different max speed value here
    }

    if (stageProperties.inputScore) {
        // 5. Score normalized based on MAX_SCORE
        let score = this.getScore(false);
        let TScore = parseFloat(score[0]);
        this.inputs.push(TScore / MAX_SCORE); // I don't think this is actually useful to the agent
    }

    if (stageProperties.inputOrientation) {
        // 6. Agent's orientation normalized to [-1, 1]
        this.inputs.push(this.mainBody.getAngle() / Math.PI);
    }

    if (stageProperties.inputTimeRemaining) {
        // 7. Time remaining normalized to [0, 1]
        this.inputs.push((simulationLengthModified - tickCount) / MAX_TIME);
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
            this.inputs.push(detectedDistance / MAX_DETECTION_DISTANCE);
        }
    }

    if (stageProperties.inputTicker) {

        if (this.genome.hyperparameters.heartbeat) {

            this.heartBeatCount += 1;

            if (this.heartBeatCount >= this.genome.hyperparameters.heartbeat) {
                this.heart *= -1;
                this.heartBeatCount = 0; // Reset after toggling the heartbeat
            }

            this.inputs.push(this.heart);

        } else {
            this.inputs.push(internalTick);
        }
    }

    return this.inputs;
};

// Que calls to update the agents muscles after collecting inputs
AgentNEAT.prototype.updateMusclesNEAT = function () {
    let inputs = this.collectInputsNEAT();
    if (stageProperties.keepAgentSymmetrical == true) {
        this.makeDecisionSymmetricalNEAT(inputs);
    } else {
        this.makeDecisionNEAT(inputs);
    }
};

// Function to render the agents neural network if enabled
AgentNEAT.prototype.renderNNNEAT = function (p, offsetX, offsetY) {
    const layerGap = stageProperties.renderedNNLayerGap; // horizontal space between layers
    const nodeGap = stageProperties.renderedNNNodeGap;   // vertical space between nodes
    let inputLabels = [];
    let outputLabels = [];
    let allWeightTensors;
    let allWeights;
    let allBiasesTensors;
    let allBiases;
    let inputIndex = 0;
    p.push();
    p.fill(GROUP_COLORS[this.genome.metadata.agentGroup]);


    if (stageProperties.inputJointAngle) {
        for (let joint of this.joints) {
            if (!joint.duplicate) {
                inputLabels.push(`Joint Angle ${inputLabels.length + 1}: ${this.inputs[inputIndex].toFixed(4)}`);
                inputIndex++; 
            }
        }
    }

    if (stageProperties.inputJointSpeed) {
        for (let joint of this.joints) {
            if (!joint.duplicate) {
                inputLabels.push(`Joint Speed ${inputLabels.length + 1}: ${this.inputs[inputIndex].toFixed(4)}`);
                inputIndex++; 
            }
        }
    }

    if (stageProperties.inputAgentPos) {
        inputLabels.push(`Agent's X: ${this.inputs[inputIndex].toFixed(4)}`, `Agent's Y: ${this.inputs[inputIndex + 1].toFixed(4)}`);
        inputIndex += 2; 
    }

    if (stageProperties.inputAgentV) {
        inputLabels.push(`Velocity X: ${this.inputs[inputIndex].toFixed(4)}`, `Velocity Y: ${this.inputs[inputIndex + 1].toFixed(4)}`);
        inputIndex += 2; 
    }

    if (stageProperties.inputScore) {
        inputLabels.push(`Score: ${this.inputs[inputIndex].toFixed(4)}`);
        inputIndex++; 
    }

    if (stageProperties.inputOrientation) {
        inputLabels.push(`Orientation: ${this.inputs[inputIndex].toFixed(4)}`);
        inputIndex++;
    }

    if (stageProperties.inputTimeRemaining) {
        inputLabels.push(`Time Left: ${this.inputs[inputIndex]}`);
        inputIndex++;
    }

    //if (stageProperties.inputGroundSensors) {
    //    inputLabels = inputLabels.concat(Array(this.joints.length).fill(null).map((_, idx) => `Ground Sensor ${idx + 1}`));
    //}

    if (stageProperties.inputDistanceSensors) {
        for (let i = 0; i < 4; i++) {
            inputLabels.push(`${['Front', 'Left', 'Right', 'Back'][i]} Eye ${this.inputs[inputIndex].toFixed(4)}`);
            inputIndex++;
        }
    }

    if (stageProperties.inputTicker) {
        inputLabels.push(`Tick: ${this.inputs[inputIndex]}`);
        inputIndex++;
    }


    if (stageProperties.outputsJointSpeed) {
        outputLabels = outputLabels.concat(
            this.joints
                .filter(joint => !joint.duplicate)
                .map((_, idx) => `Joint ${idx + 1}`));
    }

    if (stageProperties.outputsJointTorque) {
        outputLabels = outputLabels.concat(Array(this.joints.length).fill(null).map((_, idx) => `Joint ${idx + 1}`));
    }

    if (stageProperties.outputsBias) {
        outputLabels = outputLabels.concat(
            this.joints
                .filter(joint => !joint.duplicate)
                .map((_, idx) => `Joint ${idx + 1}`));
    }

    try {
        allWeightTensors = this.brain.getWeights().filter((_, idx) => idx % 2 === 0);
        allWeights = allWeightTensors.flatMap(tensor => Array.from(tensor.dataSync()));

        allBiasesTensors = this.brain.getWeights().filter((_, idx) => idx % 2 === 1);
        allBiases = allBiasesTensors.flatMap(tensor => Array.from(tensor.dataSync()));

        let currentWeightIndex = 0;
        let currentBiasIndex = 0;

        let hiddenLayers = this.genome.layerGenes.length;
        let inputNodes = this.genome.inputLayerGenes[0].numberOfNeurons;
        let outputNodes = this.genome.outputLayerGenes[0].numberOfNeurons;

        // First, render all the connections (lines)
        let x = offsetX;
        for (let i = 0; i < hiddenLayers + 2; i++) {
            let nodes = 0;
            if (i === 0) {
                nodes = inputNodes;
            } else if (i === hiddenLayers + 1) {
                nodes = outputNodes;
            } else {
                nodes = this.genome.layerGenes[i - 1].numberOfNeurons;
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
                nodes = this.genome.layerGenes[i - 1].numberOfNeurons;
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
                p.fill(GROUP_COLORS[this.genome.metadata.agentGroup]); // Default fill color
                //}

                let nodeSize = mapBiasToNodeSize(bias, maxBias);
                p.ellipse(x, y, nodeSize, nodeSize);
                p.stroke(0);
                // Add labels to the side of input and output nodes
                if (labels.length > 0) {
                    p.textSize(12);
                    if (i === 0) {
                        p.text(labels[j], x - 130, y + 4);
                    } else if (i === hiddenLayers + 1) {
                        p.text(labels[j], x + 15, y + 4);

                        //if (this.joints[j]) {
                        //    while (this.joints[j].duplicate && this.joints[j + 1]) {
                        //        j++;
                        //    }
                        //} else {
                        //    while (this.joints[(j - this.joints.length)].duplicate && this.joints[(j - this.joints.length) + 1]) {
                        //        j++;
                        //    }
                        //}

                        if (stageProperties.outputsJointSpeed && this.joints[j] && !this.joints[j].duplicate) {
                            p.fill(GROUP_COLORS[j]);
                            let currentSpeed = this.joints[j].getMotorSpeed();
                            p.text(`Speed: ${currentSpeed.toFixed(4)}`, x + 60, y + 4);
                            outputIndex++;
                        }

                        //if (stageProperties.outputsJointTorque && this.joints[j - outputIndex]) {
                        //    p.fill(GROUP_COLORS[j - outputIndex]);
                        //    p.text(`Max Torque Cant Be Polled :(`, x + 60, y + 4);
                        //    outputIndex++;
                        //}

                        if (stageProperties.outputsBias && this.biases[j - outputIndex] && !this.joints[j - outputIndex].duplicate) {
                            p.fill(GROUP_COLORS[j - outputIndex]);
                            let biasI = this.biases[j - outputIndex];
                            p.text(`Bias: ${biasI.toFixed(4)}`, x + 60, y + 4);
                            // outputIndex++;
                        }

                    }
                }
            }
            x += layerGap;
        }

    } catch (error) {
        if (error.message.includes('disposed')) {
            console.error('Attempted to access weights of a disposed model.');
            return;
        } else {
            throw error;
        }
    }
    p.pop();
};


/***   Functions For Settings Card Effects   ***/
// These should probably be moved to a separate file at some point for clarity
function initializeSettingHoverEffects() {
    const settings = document.querySelectorAll('.setting');

    settings.forEach(setting => {
        setting.tooltipActive = false;
        setting.removeEventListener('mouseenter', handleMouseEnter); // Clean up
        setting.removeEventListener('mouseleave', handleMouseLeave); // Clean up

        setting.addEventListener('mouseenter', handleMouseEnter);
        setting.addEventListener('mouseleave', handleMouseLeave);
    });
}

// Function to handle mouse enter event, creating the tooltip
function handleMouseEnter(e) {
    const original = e.currentTarget;
    if (original.tooltipActive) {
        return; // Don't create tooltip if one is already active
    }

    original.tooltipActive = true; // Set flag to indicate tooltip is active

    const description = original.querySelector('.setting-details').innerHTML;
    const tooltip = document.createElement('div');
    tooltip.innerHTML = description;

    const rect = original.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.top = `${rect.bottom + window.scrollY}px`; // Position below the card
    tooltip.style.left = `${rect.left + window.scrollX + 1}px`;
    tooltip.style.width = `${rect.width}px`;
    tooltip.style.zIndex = '1000';
    tooltip.style.padding = '10px';
    tooltip.style.paddingBottom = '50px';
    tooltip.style.backgroundColor = '#344444';
    tooltip.style.borderRadius = '8px';
    tooltip.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    tooltip.style.fontSize = '11px';
    tooltip.style.color = '#aaa';
    tooltip.style.margin = '8px 0 6px 0';
    tooltip.style.pointerEvents = 'none';

    document.body.appendChild(tooltip);

    // Adjust the bottom padding of the tab-content
    adjustTabContentPaddingForTooltip(tooltip, true);

    original.tooltip = tooltip;

    // Set a timer to automatically remove the tooltip
    original.tooltipTimeout = setTimeout(() => {
        if (original.tooltip) {
            // adjustTabContentPaddingForTooltip(tooltip, false);
            document.body.removeChild(original.tooltip);
            original.tooltip = null;
        }
    }, 5000); // 3 seconds timeout or as needed
}

// Function to handle mouse leave event, removing the tooltip
function handleMouseLeave(e) {
    const original = e.currentTarget;
    original.tooltipActive = false; // Reset flag when mouse leaves

    if (original.tooltip) {
        adjustTabContentPaddingForTooltip(original.tooltip, false);
        document.body.removeChild(original.tooltip);
        original.tooltip = null;
        // Adjust the bottom padding of the tab-content
        //setTimout(() => {
        //}, 10);
        clearTimeout(original.tooltipTimeout);
    }
}

function clearAllTooltips() {
    document.querySelectorAll('.setting-tooltip').forEach(tooltip => {
        tooltip.parentNode.removeChild(tooltip);
    });
}

// Helper function to adjust the padding of the tab-content to accommodate the tooltip
function adjustTabContentPaddingForTooltip(tooltip, add) {
    const tabContent = document.querySelector('.tab-content');
    const popupRect = tooltip.getBoundingClientRect();
    const additionalPadding = Math.max(0, (popupRect.height));

    if (add) {
        tabContent.style.paddingBottom += `${additionalPadding}px`;
    }
    else {
        tabContent.style.paddingBottom -= `${-additionalPadding}px`;
    }
}

window.initializeSettingHoverEffects = initializeSettingHoverEffects;
window.clearAllTooltips = clearAllTooltips;


/***   Functions For Building the Genome Viewer UI   ***/
// This function is called when the user clicks on the "View Genome" button
function createTreeView(container, obj) {
    if (typeof obj === 'object' && obj !== null) {
        Object.entries(obj).forEach(([key, value]) => {
            const keyValuePair = document.createElement('div');
            keyValuePair.className = 'key-value-pair';

            const keyElement = document.createElement('span');
            keyElement.className = 'key';
            keyElement.innerText = key + ': ';

            keyValuePair.appendChild(keyElement);

            if (typeof value === 'object' && value !== null) {
                const collapsible = document.createElement('button');
                collapsible.className = 'collapsible';
                collapsible.innerText = 'Expand';

                // Apply styles directly
                collapsible.style.backgroundColor = '#555';
                collapsible.style.color = 'white';
                collapsible.style.cursor = 'pointer';
                collapsible.style.padding = '5px 10px';
                collapsible.style.border = '1px solid #777';
                collapsible.style.borderRadius = '4px';
                collapsible.style.textAlign = 'center';
                collapsible.style.fontSize = '13px';
                collapsible.style.marginLeft = '10px';
                collapsible.style.transition = 'background-color 0.3s';

                collapsible.onmouseover = function () {
                    this.style.backgroundColor = '#666';
                };
                collapsible.onmouseout = function () {
                    this.style.backgroundColor = '#555';
                };

                keyValuePair.appendChild(collapsible);

                const content = document.createElement('div');
                content.className = 'content';
                content.style.display = 'none';
                keyValuePair.appendChild(content);

                createTreeView(content, value);

                collapsible.addEventListener('click', function () {
                    this.classList.toggle('active');
                    const content = this.nextElementSibling;
                    if (content.style.display === 'block') {
                        content.style.display = 'none';
                        this.innerText = 'Expand';
                    } else {
                        content.style.display = 'block';
                        this.innerText = 'Collapse';
                    }
                });
            } else {
                const valueElement = document.createElement('span');
                valueElement.className = 'value';
                valueElement.innerText = value !== null ? value.toString() : 'null';
                keyValuePair.appendChild(valueElement);
            }

            container.appendChild(keyValuePair);
        });
    } else {
        container.innerText = obj !== null ? obj.toString() : 'null';
    }
}

