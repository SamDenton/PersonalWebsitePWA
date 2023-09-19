///* Initialization vars taken from C# */
//let canvasWidth, canvasHeight, groundY, GravityStrength, FrictionStrength, simulationSpeed, showNeuralNetwork, delay, UIUpdateInterval, simulationLength, torque, maxJointMovement, jointMaxMove;
//let renderedAgents, popSize, topPerformerNo, agentToFix, BATCH_SIZE, MAX_ADJUSTMENT, CROSS_GROUP_PROBABILITY, MIN_GROUP_SIZE, MAX_GROUP_SIZE, TOURNAMENT_SIZE, MUSCLE_BATCH_SIZE, SOME_DELAY_FRAME_COUNT, muscleUpdateFrames, brainDecay;
//let velocityIterations, positionIterations, physicsGranularityMultiplier;

let liquidViscosityDecay, mapNo;
let MAX_ADJUSTMENT_TORQUE = 500000;
let offsetY = 0;
let simulationLengthModified = 0;
let showRayCasts = false;


///* Index's, flags */
//let currentAgentIndex = 0;
//let offsetX = 0;
//let displayedFPS = 0;
//let tickCount = 0;
//let lastUIUpdateTime = 0;
//let topScoreEver = 0;
//let stabilityCounter = 0;
//let isInitializationComplete, lastFPSCalculationTime, genCount, displayedTimeLeft, frameCountSinceLastFPS, simulationStarted, nextBatchFrame, usedIndice, averageScore, currentProcess;

///* P5 vars */
//let p5Instance = null;

///* Grouping arrays */
//let agents = [];
//let leadingAgents = [];
//let randomlySelectedAgents = [];

///* Agent and joint colours */
//const GROUP_COLORS = [
//    '#FF5733', '#33FF57', '#25221B', '#474B4E', '#424632', '#4A192C', '#3357FF', '#FF33F4', '#FFFC33', '#F05703',
//    '#376D57', '#3328CF', '#FF33FF', '#F4FC33', '#8A6642', '#B5B8B1', '#781F19', '#8A9597', '#F5D033', '#633A34'
//];
//const JOINT_COLORS = [
//    '#376D57', '#3328CF', '#FF33FF', '#F4FC33', '#8A6642', '#B5B8B1', '#781F19', '#8A9597', '#F5D033', '#633A34',
//    '#FF5733', '#33FF57', '#25221B', '#474B4E', '#424632', '#4A192C', '#3357FF', '#FF33F4', '#FFFC33', '#F05703'
//];

///* Planck vars */
//let world, groundBody;
//const CATEGORY_GROUND = 0x0001;
//const CATEGORY_AGENT_BODY = 0x0002;
//const CATEGORY_AGENT_LIMB = 0x0004;

///* TensorFlow vars */
//let numGroups;

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


/*  Everything above this is initialised in old JS, will move vars across as they are updated */

let wallBodies = [];
let duplicateWalls = [];

let sketchNEAT = function (p) {
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
    const dragCoefficient = liquidViscosityDecay; 
    let particles = [];

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
                        nextBatchFrame = tickCount + muscleUpdateFrames;
                    } else {
                        // Wait for batchDelay frames before moving to the next batch
                        nextBatchFrame = tickCount + SOME_DELAY_FRAME_COUNT;
                    }
                }
            }

            // Give the agents movement by waving limbs to simulate swimming
            for (let agent of agents) {
                if (agent) {
                    for (let i = 0; i < agent.joints.length; i++) {
                        let angle = (i * 2 * Math.PI) / agent.numLimbs;
                        let joint = agent.joints[i];
                        let currentAngle = joint.getJointAngle();
                        let N = 5;
                        let forceScalingFactor = swimStrengthMultiplier;
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

                            let bias;

                            if (!outputsBias || !simulationStarted || !agent.biases || i >= agent.biases.length || agent.biases[i] == null) {
                                bias = swimBiasMultiplier;
                            } else {
                                bias = agent.biases[i];
                            }

                            let forceMagnitude;
                            if (agent.numLimbs % 2 === 0) {
                                if (i == 0) {
                                    forceMagnitude = deltaTheta * forceScalingFactor;
                                } else if (i < agent.numLimbs / 2) {
                                    forceMagnitude = deltaTheta * forceScalingFactor * bias;
                                } else if (i == agent.numLimbs / 2) {
                                    forceMagnitude = deltaTheta * forceScalingFactor;
                                } else {
                                    forceMagnitude = deltaTheta * forceScalingFactor * (2 - bias);
                                }
                            } else {
                                if (i == 0) {
                                    forceMagnitude = deltaTheta * forceScalingFactor;
                                } else if (i < agent.numLimbs / 2) {
                                    forceMagnitude = deltaTheta * forceScalingFactor * bias;
                                } else {
                                    forceMagnitude = deltaTheta * forceScalingFactor * (2 - bias);
                                }
                            }

                            //let bias = 1.1;
                            //let forceMagnitude
                            //if (i > agent.numLimbs) {
                            //    forceMagnitude = deltaTheta * forceScalingFactor * bias;
                            //} else {
                            //    forceMagnitude = deltaTheta * forceScalingFactor * (2 - bias);
                            //}

                            // Calculate the force vector
                            let force = planck.Vec2(Math.cos(forceDirection) * forceMagnitude, Math.sin(forceDirection) * forceMagnitude);

                            // Calculate the point on the limb to apply the force
                            let forceApplyPointX = agent.limbs[i].getPosition().x + Math.cos(angle) * (agent.limbLength / 1);
                            let forceApplyPointY = agent.limbs[i].getPosition().y + Math.sin(angle) * (agent.limbLength / 1);

                            let forceApplyPoint = planck.Vec2(forceApplyPointX, forceApplyPointY);

                            agent.limbs[i].applyForce(force, forceApplyPoint, true);
                            //// Now, visualize this force
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
            }

            // Apply drag to agents to simulate a liquid enviroment
            for (let agent of agents) {
                if (simulationStarted) {
                    // Apply drag to the main body
                    let bodyVelocity = agent.mainBody.getLinearVelocity();
                    agent.mainBody.setLinearVelocity(bodyVelocity.mul(dragCoefficient));

                    // Apply drag to each limb
                    for (let limb of agent.limbs) {
                        let limbVelocity = limb.getLinearVelocity();
                        limb.setLinearVelocity(limbVelocity.mul(dragCoefficient));
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
                if (tickCount >= simulationLengthModified) {
                    endSimulationNEAT(p);
                }
            }
        }
    }

    function renderScene(p) {
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

            // Target circle in the center
            //p.fill(100, 0, 0);
            //p.ellipse(canvasWidth / 2 + offsetX, canvasHeight / 2, 50);
            //p.noStroke();
            //p.fill(50, 50, 0); // Dark brownish color
            //p.rect(0, p.height - 30, p.width, 30); // Bottom rectangle

            //p.fill(100, 100, 0); // Light brownish color
            //p.ellipse(100, p.height - 20, 20, 20); // Some random rocks
            //p.ellipse(200, p.height - 25, 30, 30);



            //for (let i = 0; i < p.height; i += 40) {
            //    p.stroke(220, 210, 170); // Lighter sand color
            //    p.noFill();
            //    p.beginShape();
            //    for (let j = 0; j < p.width; j++) {
            //        let yOffset = 5 * Math.sin(j * 0.05 + i * 0.1);
            //        p.vertex(j, i + yOffset);
            //    }
            //    p.endShape();
            //}

            //const patchCount = 50;
            //for (let i = 0; i < patchCount; i++) {
            //    p.fill(60, 120, 80, 60); // Semi-transparent greenish-brown
            //    let x = Math.random() * p.width;
            //    let y = Math.random() * p.height;
            //    let w = 20 + Math.random() * 40;
            //    let h = 20 + Math.random() * 40;
            //    p.ellipse(x, y, w, h);
            //}

            //const stoneCount = 30;
            //for (let i = 0; i < stoneCount; i++) {
            //    p.fill(100 + Math.random() * 50, 100 + Math.random() * 50, 100 + Math.random() * 50);
            //    let x = Math.random() * p.width;
            //    let y = Math.random() * p.height;
            //    p.ellipse(x, y, 10 + Math.random() * 15, 10 + Math.random() * 15);
            //}



            particles.forEach((particle) => {
                particle.x += Math.sin(particle.phase) * 0.5;
                particle.y += Math.cos(particle.phase) * 0.5;
                particle.phase += 0.02;

                if (particle.x > p.width) particle.x = 0;
                if (particle.x < 0) particle.x = p.width;
                if (particle.y > p.height) particle.y = 0;
                if (particle.y < 0) particle.y = p.height;

                p.fill(255, 255, 255, 50);
                p.noStroke();
                p.ellipse(particle.x, particle.y, 2, 2);
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
                leadingAgentMovementScore = leadingAgentScores[4];
                leadingAgentExplorationReward = leadingAgentScores[5];

                // Display the score of the trailing agent
                trailingAgentScores = trailingAgent.getScore(false);
                trailingAgentScore = trailingAgentScores[0];
                trailingAgentXScore = trailingAgentScores[1];
                trailingAgentYScore = trailingAgentScores[2];
                trailingAgentMovementScore = trailingAgentScores[4];
                trailingAgentExplorationReward = trailingAgentScores[5];

                // Display the score of the highest scoring
                topScoreAgentScores = topScoreAgent.getScore(false);
                topScoreAgentScore = topScoreAgentScores[0];
                topScoreAgentXScore = topScoreAgentScores[1];
                topScoreAgentYScore = topScoreAgentScores[2];
                topScoreAgentMovementScore = topScoreAgentScores[4];
                topScoreAgentExplorationReward = topScoreAgentScores[5];

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

            // Render the FPS, Gen No, and Time Left
            p.fill(255);  // Black color for the text
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
            p.fill(155);
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

            if (topScoreAgentScore > - 1000) {
                p.textSize(16);
                p.fill(GROUP_COLORS[topScoreAgent.group]);
                p.text(`Top Scoring Agent: ${topScoreAgentScore} (X Score: ${topScoreAgentXScore} + Y Score: ${topScoreAgentYScore} + Joint Movement Bonus: ${topScoreAgentMovementScore} + Exploration Bonus: ${topScoreAgentExplorationReward})`, 10, groundY + 30);  // Displaying the score just below the ground

                p.fill(GROUP_COLORS[leadingAgent.group]);
                p.text(`Leading Agent Score: ${leadingAgentScore} (X Score: ${leadingAgentXScore} + Y Score: ${leadingAgentYScore} + Joint Movement Bonus: ${leadingAgentMovementScore} + Exploration Bonus: ${leadingAgentExplorationReward})`, 10, groundY + 50);

                p.fill(GROUP_COLORS[trailingAgent.group]);
                p.text(`Trailing Agent Score: ${trailingAgentScore} (X Score: ${trailingAgentXScore} + Y Score: ${trailingAgentYScore} + Joint Movement Bonus: ${trailingAgentMovementScore} + Exploration Bonus: ${trailingAgentExplorationReward})`, 10, groundY + 70);
            }

            if (showNeuralNetwork == true) {
                if (agentToFix == "trailer") {
                    p.text(`Showing Trailing Agents Brain`, 370, 20);
                    // Render NN for leading agent
                    p.fill(GROUP_COLORS[trailingAgent.group]);
                    trailingAgent.renderNNNEAT(p, canvasWidth - 1000, (canvasHeight / 2) - 40, tickCount);
                } else {
                    p.text(`Showing Leading Agents Brain`, 370, 20);
                    // Render NN for leading agent
                    p.fill(GROUP_COLORS[leadingAgent.group]);
                    leadingAgent.renderNNNEAT(p, canvasWidth - 1000, (canvasHeight / 2) - 40, tickCount);
                }
            }

            if (agentsToRender.size > 1) {
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
                            if (agent.group == selectedColor) {
                                let agentOffsetX = offsetX - agent.startingX;
                                let agentOffsetY = offsetY - agent.startingY;
                                agent.render(p, agentOffsetX, agentOffsetY);
                            }
                        }
                    }
                }
            }
            p.fill(255);
        }
    };
};

//function areAllAgentsStable() {
//    const stabilityThreshold = 0.001;  // Define a small threshold value for stability
//    const stabilityFrames = 240;  // Number of frames to wait before confirming stability

//    let allAgentsStable = true;

//    for (let agent of agents) {
//        if (agent.mainBody) {
//            if (Math.abs(agent.mainBody.getLinearVelocity()) > stabilityThreshold) {
//                allAgentsStable = false;
//                break;
//            }
//        }
//    }

//    if (allAgentsStable) {
//        stabilityCounter++;
//        if (stabilityCounter >= stabilityFrames) {
//            stabilityCounter = 0;  // Reset counter
//            return true;
//        }
//    } else {
//        stabilityCounter = 0;  // Reset counter if any agent is not stable
//    }

//    return false;
//}

function initializeSketchBox2DNEAT(stageProperties) {
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
    liquidViscosityDecay = stageProperties.liquidViscosity;
    increaseTimePerGen = stageProperties.timeIncrease;
    mapNo = stageProperties.map;

    simulationLengthModified = simulationLength;
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
    p5Instance = new p5(sketchNEAT, 'canvas-container-NEAT');
}

//function toggleNNRender(showNN) {
//    showNeuralNetwork = showNN;
//    console.log("toggling NN render");
//}

function toggleRayCastRender(showRays) {
    showRayCasts = showRays;
    console.log("toggling RayCasts render");
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

//function calculateFPS(p) {
//    frameCountSinceLastFPS++;
//    let currentTime = p.millis();
//    if (currentTime - lastFPSCalculationTime > UIUpdateInterval) {
//        displayedFPS = frameCountSinceLastFPS / (UIUpdateInterval / 1000); // Convert to frames per second
//        frameCountSinceLastFPS = 0;
//        lastFPSCalculationTime = currentTime;
//    }
//}

//this agent will do for now, but I intend to replace with with a dynamic body plan that can 'evolve' over time.
//I think a JSON file defining a series of body and limb shapes, possibly with limbs connected to limbs etc
//Starting from a random config, this would not work, as there would be little chance of initial fitness, but starting from a simple body plan and exolving complexity based on randomness and fitness might work.
function AgentNEAT(numLimbs, agentNo, existingBrain = null) {
    this.numLimbs = numLimbs;
    this.index = agentNo;
    this.group = null;
    // console.log("a new agent, index: " + this.index);
    let mainBodyRadius = 20;
    const locationBatchSize = 20;
    this.startingX = 200 + (Math.floor(this.index / locationBatchSize) * 5000);
    // let startingX = 100;
    this.startingY = 600;
    // this.jointMaxMove = maxJointMovement;  // Temporary
    // this.agentMutationRateLocal = agentMutationRate; // Temporary
    this.limbBuffer = Array(this.numLimbs).fill().map(() => []);
    //    this.mainBody = createMainBody(world, this.startingX, startingY, mainBodyRadius, agentNo);
    this.mainBody = createMainBodyNEAT(world, this.startingX, this.startingY, mainBodyRadius, agentNo);
    this.position = this.mainBody.getPosition();

    this.rayCastPoints = [];

    this.internalMap = [];
    this.coveredCellCount = 0;

    for (let i = 0; i < 500; i++) {
        let row = [];
        for (let n = 0; n < 500; n++) {
            row.push(false);
        }
        this.internalMap.push(row);
    }

    this.limbs = [];
    this.muscles = [];
    this.joints = [];
    this.biases = [];

    for (let i = 0; i < this.numLimbs; i++) {
        this.biases.push(1.5);
    }

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

    for (let i = 0; i < this.numLimbs; i++) {
        let angle = (i * 2 * Math.PI) / this.numLimbs;
        // let limbX = this.startingX + Math.cos(angle) * (mainBodyRadius + limbLength);
        let limbX = this.startingX + Math.cos(angle) * (mainBodyRadius + this.limbLength);
        let limbY = this.startingY + Math.sin(angle) * (mainBodyRadius + this.limbLength);

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
    this.nnConfig = nnConfig || new NeuralNetworkConfigNEAT(this.numLimbs);
    if (existingBrain) {
        this.brain = existingBrain;
    } else {
        this.brain = createNeuralNetworkNEAT(this.nnConfig);
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
            let change = Math.abs(currentAngle - this.previousJointAngles[i]);
            totalChange += change;

            // Update the previous angle for next time
            this.previousJointAngles[i] = currentAngle;
        }

        // Exponential decay for the reward. You can adjust the decay factor as needed.
        let decayFactor = 0.90;
        let currentReward = totalChange * decayFactor ** totalChange;

        // Accumulate joint movement reward
        this.totalJointMovementReward += currentReward;

        return this.totalJointMovementReward;
    };

    this.getExplorationReward = function () {

        // Calculate the position relative to the map's origin (considering the granularity)
        let gridX = Math.floor((this.position.x - this.startingX) / 50);
        let gridY = Math.floor((this.startingY - this.position.y) / 50);  // Subtracting due to flipped Y-axis

        if (gridX >= 0 && gridX < 500 && gridY >= 0 && gridY < 500) {
            if (!this.internalMap[gridY][gridX]) { // If the cell hasn't been visited yet
                this.internalMap[gridY][gridX] = true;  // Mark the cell as visited
                this.coveredCellCount++;  // Increment the covered cell count
            }
        }

        return this.coveredCellCount;
    };

    //this.totalXMovementReward = 0;
    //this.totalYMovementReward = 0;

    // Old tracking variables for incremental pos score: Initialize previousXPos to starting x-position
    //this.previousXPos = this.startingX;
    //this.previousYPos = this.startingY;

    this.furthestXPos = this.startingX;
    this.furthestYPos = this.startingY;

    this.getScore = function (roundOver) {

        // Old incrementing Movement score, with time factor included(In use on old genetic evolution sim):
        /*
        // Calculate change in x-position
        let deltaX = this.position.x - this.previousXPos;
        let deltaY = this.position.y - this.previousYPos;

        let currentXReward;
        let currentYReward;

        if (displayedTimeLeft > 1) {
            // let TimeFactor = 1 + tickCount / simulationLength;
            let TimeFactor = 1;
            // currentXReward = deltaX * TimeFactor * 2;  // Linier growth of x reward
            // currentXReward = deltaX ** TimeFactor ** 2; // non linier,
            currentXReward = deltaX * Math.exp(TimeFactor - 1);
            currentYReward = deltaY * Math.exp(TimeFactor - 1);
        } else {
            currentXReward = 0;
            currentYReward = 0;
        }


         Accumulate x movement reward
        this.totalXMovementReward += Math.abs(currentXReward);
        this.totalYMovementReward += Math.abs(currentYReward);

         Update the previous x position for next time
        this.previousXPos = this.position.x;
        this.previousYPos = this.position.y;

        let XPosScore = this.totalXMovementReward * 1;
        let YPosScore = Math.abs(this.totalYMovementReward) * 1;
        */

        //Old simple X,Y score calculation
        //let XPosScore = (Math.floor(this.position.x - this.startingX) * 1);
        //let YPosScore = (Math.floor(this.startingY - this.position.y) * 1);


        if (this.position.x > this.furthestXPos) {
            this.furthestXPos = this.position.x;
        }
        if (this.position.y < this.furthestYPos) {  // Assuming north is negative Y
            this.furthestYPos = this.position.y;
        }

        // If the agent has made new progress in the x or y direction, update the furthest position.
        let XPosScore = Math.floor(this.furthestXPos - this.startingX) * 1;
        let YPosScore = Math.floor(this.startingY - this.furthestYPos) * 1.2;

        let jointMovementReward = (this.getJointMovementReward() * 15 / this.numLimbs) * 0.5; // Adjust multiplier if needed

        let explorationReward = this.getExplorationReward() * 10;

        let weightPenalty;
        if (roundOver) {
            weightPenalty = this.getWeightPenalty() * 200;
        } else {
            weightPenalty = 0;
        }

        this.Score = XPosScore + YPosScore + jointMovementReward + explorationReward - weightPenalty;

        if (this.Score > topScoreEver) {
            topScoreEver = this.Score;
        }

        return [
            this.Score.toFixed(2),
            XPosScore.toFixed(2),
            YPosScore.toFixed(2),
            weightPenalty.toFixed(2),
            jointMovementReward.toFixed(2),
            explorationReward
        ];
    };

    this.render = function (p, offsetX, offsetY) {
        // Set the fill color based on group
        p.fill(GROUP_COLORS[this.group]);
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

            // Rotate arrow stem 90 degrees clockwise (to face East or 3:00)
           /* p.rotate(Math.PI / 2);*/

            p.fill(0);
            // Draw arrow stem pointing right (East)
            p.strokeWeight(2); // Adjust thickness of the arrow as needed
            p.line(0, 0, arrowLength, 0);

            // Draw the arrowhead
            p.triangle(arrowLength, 0,
                arrowLength - arrowBase, arrowBase / 2,
                arrowLength - arrowBase, -arrowBase / 2);

            p.pop();
            p.fill(GROUP_COLORS[this.group]);
        }
        //p.fill(0);
        //p.fill(GROUP_COLORS[this.group]);

        // Render the limbs
        for (let i = 0; i < this.numLimbs; i++) {
            let limb = this.limbs[i];
            if (limb) {
                let limbPos = limb.getPosition();
                let limbAngle = limb.getAngle();
                p.push();
                p.translate(limbPos.x + offsetX, limbPos.y + offsetY);  // Added offsetX
                p.rotate(limbAngle);
                p.rect(-this.limbWidth / 2, -this.limbLength / 2, this.limbWidth, this.limbLength);
                p.pop();
            }
        }

        // Render the joints
        for (let i = 0; i < this.numLimbs; i++) {
            if (this.joints[i]) {
                let jointPos = this.joints[i].getAnchorA();
                // Check if the current joint's index is within the jointColors array length
                if (i < JOINT_COLORS.length) {
                    p.fill(JOINT_COLORS[i]);  // Set the fill color to the corresponding color from the jointColors array
                } else {
                    p.fill(0, 255, 0);  // Default fill color if there isn't a corresponding color in the array
                }
                p.ellipse(jointPos.x + offsetX, jointPos.y + offsetY, 7, 7);  // Added offsetX
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

    this.renderRayCasts = function (p, offsetX, offsetY) {
        p.stroke(255, 0, 0);  // Set the color of the rays (red in this case)

        for (let ray of this.rayCastPoints) {
            let startX = ray.start.x + offsetX;
            let startY = ray.start.y + offsetY;
            let endX = ray.end.x + offsetX;
            let endY = ray.end.y + offsetY;

            p.line(startX, startY, endX, endY);
        }

    };

}

function createMainBodyNEAT(world, x, y, radius, agentNo) {
    let bodyDef = {
        type: 'static',
        position: planck.Vec2(x, y)
    };

    let body = world.createBody(bodyDef);
    let shape = planck.Circle(radius);
    let fixtureDef = {
        shape: shape,
        density: 0.5,
        filterCategoryBits: CATEGORY_AGENT_BODY,
        filterMaskBits: CATEGORY_GROUND  // Only allow collision with the ground
    };
    body.createFixture(fixtureDef);
    // body.setUserData("Agent " + agentNo + " Main Body");
    return body;
}

//function createLimb(world, x, y, width, height, angle, agentNo, limbNo) {
//    let bodyDef = {
//        type: 'dynamic',
//        position: planck.Vec2(x, y),
//        angle: angle
//    };

//    let body = world.createBody(bodyDef);
//    let shape = planck.Box(width / 2, height / 2);

//    // Assign a negative group index based on the agent number
//    // This ensures that limbs of the same agent will never collide with each other
//    let groupIndex = -agentNo;

//    let fixtureDef = {
//        shape: shape,
//        density: 0.1,
//        filterCategoryBits: CATEGORY_AGENT_LIMB,
//        filterMaskBits: CATEGORY_GROUND,  // Only allow collision with the ground
//        filterGroupIndex: groupIndex      // Set the group index
//    };
//    body.createFixture(fixtureDef);
//    // body.setUserData("Agent " + agentNo + " Limb " + limbNo);

//    return body;
//}

//function createRevoluteJoint(world, bodyA, bodyB, localAnchorA, localAnchorB, lowerAngle, upperAngle) {
//    let limiter = true;
//    if (jointMaxMove == 0) {
//        limiter = false;
//    }
//    let jointDef = {
//        bodyA: bodyA,
//        bodyB: bodyB,
//        localAnchorA: localAnchorA,
//        localAnchorB: localAnchorB,
//        lowerAngle: lowerAngle,
//        upperAngle: upperAngle,
//        enableLimit: limiter,
//        motorSpeed: 0.0,
//        maxMotorTorque: torque,
//        enableMotor: true
//    };

//    return world.createJoint(planck.RevoluteJoint(jointDef, bodyA, bodyB));
//}

function initializeAgentsBox2DNEAT(agentProperties) {
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
    agentMutationRate = agentProperties.offspringMutationRate;
    swimStrengthMultiplier = agentProperties.swimStrength;
    inputsDistanceSensors = agentProperties.inputDistanceSensors;
    swimBiasMultiplier = agentProperties.swimBias;
    outputJointSpeed = agentProperties.outputsJointSpeed;
    outputJointTorque = agentProperties.outputsJointTorque;
    outputBias = agentProperties.outputsBias;

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
        initializeAgentBatchNEAT(i, Math.min(i + BATCH_SIZE, popSize), agentsPerGroup);
    }

    waitForFirstInitializationCompletion();

    displayedTimeLeft = (simulationLength - tickCount) * (1 / simulationSpeed);
}

// Function to initialize a batch of agents
function initializeAgentBatchNEAT(startIndex, endIndex, agentsPerGroup) {
    for (let i = startIndex; i < endIndex; i++) {
        initializeAgentNEAT(i, agentsPerGroup);
    }
}

// Function to initialize a single agent
function initializeAgentNEAT(i, agentsPerGroup) {
    setTimeout(() => {
        // let randLimbsPerAgent = 1 + Math.random() * 9;
        let agent = new AgentNEAT(limbsPerAgent, i);
        let randomAngle = -Math.random() * Math.PI / 2; // Random angle between 0 and -PI/2
        agent.mainBody.setAngle(randomAngle);
        // console.log("initializeAgent, making agent: ", i);
        agent.group = Math.floor(i / agentsPerGroup);  // Assign group
        agents.push(agent);
       // If this is the last agent, mark initialization as complete
        if (agents.length >= popSize - 1) {
            isInitializationComplete = true;
        }
    }, i * delay);
}

//function waitForFirstInitializationCompletion() {
//    // Check if agents initialised
//    if (isInitializationComplete) {
//        // Randomly select agents to render for each group
//        randomlySelectedAgents = [];
//        for (let groupId = 0; groupId < numGroups; groupId++) {
//            let groupAgents = agents.filter(agent => agent.group === groupId);

//            // Select few random agents
//            for (let i = 0; i < renderedAgents; i++) {
//                let randomIndex = Math.floor(Math.random() * groupAgents.length);
//                randomlySelectedAgents.push(groupAgents[randomIndex]);
//                // console.log("adding random agent to render list, group: " + groupId);
//            }
//        }

//        offsetX = 0;

//    } else {
//        // If the agents not initialised, wait for some time and check again
//        setTimeout(waitForFirstInitializationCompletion, 100); // Checking every 100ms
//    }
//}

function getLeadingAgentNEAT(frameCounter) {
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
        (((agent.position.x - agent.startingX) + (1 - agent.position.y - agent.startingY)) > ((leading.position.x - leading.startingX) + (1 - leading.position.y - leading.startingY)) ? agent : leading),
        agents[0]
    );
}

function getLastAgentNEAT() {
    if (agents.length === 0) return null;

    return agents.reduce((trailing, agent) =>
        (((agent.position.x - agent.startingX) + (1 - agent.position.y - agent.startingY)) < ((trailing.position.x - trailing.startingX) + (1 - trailing.position.y - trailing.startingY)) ? agent : trailing),
        agents[0]
    );
}

//function getHighestScore() {
//    if (agents.length === 0) return null;

//    agents.sort((a, b) => parseFloat(b.getScore(false)[0]) - parseFloat(a.getScore(false)[0]));

//    return agents[0];
//}

function endSimulationNEAT(p) {
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

    for (let wall of wallBodies) {
        world.destroyBody(wall.body);
    }
    wallBodies = []; 

    for (let wall of duplicateWalls) {
        world.destroyBody(wall.body);
    }
    duplicateWalls = [];

    // Continue to the next generation
    nextGenerationNEAT(p);
}

function setupPlanckWorldNEAT() {
    // Create the Planck.js world
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
    let randMap = Math.floor(Math.random() * 5);
    createMaps(randMap);
}

function createMaps(mapNumber) {
    let startX = 200;
    let startY = 600;

    if (mapNumber == 0) {
        // Map starts agents in a channel with obsticles to get around, then opens up to free space
        let channelWidth = 200;
        let channelLength = 800;

        // Create the two long walls along the path
        createWall(startX + 150, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100, 10, channelLength, Math.PI / 4); // Right wall

        // Create the short wall at the bottom of the path
        createWall(startX - 50, startY + 100, 10, channelWidth, -Math.PI / 4); // Bottom wall

        // Obsticles
        createWall(startX + 50, startY - 80, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 130 + channelWidth, startY - channelWidth, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 460, startY - 490, 10, channelWidth / 2, -Math.PI / 4);

    } else if (mapNumber == 1) {
        // Map starts egants in free space and forces them to find the channel and complete it to move further
        let channelWidth = 200;
        let channelLength = 800;

        startX += 400;
        startY -= 400;

        // Create the two long walls along the path
        createWall(startX + 150, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100, 10, channelLength, Math.PI / 4); // Right wall

        // Create the boundry walls to force agents through channel
        createWall(startX - 480, startY - 330, 10, 1000, -Math.PI / 4);
        createWall(startX + 380, startY + 530, 10, 1000, -Math.PI / 4);
        createWall(startX + 150 - 1000, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100 + 1000, 10, channelLength, Math.PI / 4); // Right wall

        // Obsticles
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
        // Map starts agents in a channel with obsticles to get around, then opens up to free space
        let channelWidth = 200;
        let channelLength = 800;

        startY -= 50;
        startX -= 50;

        // Create the two long walls along the path
        createWall(startX + 150, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100, 10, channelLength, Math.PI / 4); // Right wall

        // Create the short wall at the bottom of the path
        createWall(startX - 50, startY + 100, 10, channelWidth, -Math.PI / 4); // Bottom wall

        // Obsticles
        createWall(startX + 50 + 75, startY - 80 + 75, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 130 + 75, startY - channelWidth - 50, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 460 + 75, startY - 490 + 75, 10, channelWidth / 2, -Math.PI / 4);

    } else if (mapNumber == 4) {
        // Map starts egants in free space and forces them to find the channel and complete it to move further
        let channelWidth = 200;
        let channelLength = 800;

        startX += 400;
        startY -= 400;

        // Create the two long walls along the path
        createWall(startX + 150, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100, 10, channelLength, Math.PI / 4); // Right wall

        // Create the boundry walls to force agents through channel
        createWall(startX - 480, startY - 330, 10, 1000, -Math.PI / 4);
        createWall(startX + 380, startY + 530, 10, 1000, -Math.PI / 4);
        createWall(startX + 150 - 1000, startY - channelWidth - 50, 10, channelLength, Math.PI / 4); // Left wall
        createWall(startX + 100 + channelWidth, startY - 100 + 1000, 10, channelLength, Math.PI / 4); // Right wall

        // Obsticles
        createWall(startX + 50 + 75, startY - 80 + 75, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 130 + 75, startY - channelWidth - 50, 10, channelWidth / 2, -Math.PI / 4);
        createWall(startX + 460 + 75, startY - 490 + 75, 10, channelWidth / 2, -Math.PI / 4);

    }
}

function createWall(x, y, width, height, angle = 0) {
    for (let i = 0; i < Math.ceil(popSize / 20); i++) {
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

function NeuralNetworkConfigNEAT(numLimbs) {
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
    if (inputsDistanceSensors) this.inputNodes += 4;

    // Configure the rest of the neural network
    this.hiddenLayers = [{ nodes: 20, activation: 'relu' }, { nodes: 15, activation: 'relu' }, { nodes: 10, activation: 'relu' }];

    this.outputNodes = 0;
    if (outputJointSpeed) this.outputNodes += numLimbs;
    if (outputJointTorque) this.outputNodes += numLimbs;
    if (outputBias) this.outputNodes += numLimbs;

    this.mutationRate = 0.01;
    //this.mutationRate = Math.random();  // A random mutation rate between 0 and 1
}

function createNeuralNetworkNEAT(config) {
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

function nextGenerationNEAT(p) {
    usedIndices = new Set();
    let newAgents = [];
    let groupAgents;
    let topPerformersCount;

    let randMap = Math.floor(Math.random() * 5);
    createMaps(randMap);

    // calculate average network 'pattern'
    let averageBrain = calculateAllAverageDistances();

    // Sort in descending order of score, including the bonus for being different from the average.
    agents.sort((a, b) => {
        const aScore = a.getScore(true)[0];
        const bScore = b.getScore(true)[0];
        const aDistance = distanceToAverage(a, averageBrain[a.group]) / 100;
        const bDistance = distanceToAverage(b, averageBrain[b.group]) / 100;

        // Adjust the score with the distance to the average brain
        const aTotal = aScore + aDistance ** 2 * 1;
        const bTotal = bScore + bDistance ** 2 * 1;

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
        createTopPerformersNEAT(groupAgents, topPerformersCount, newAgents);

        // Generate offspring within the group
        generateOffspringNEAT(groupAgents, newAgents, groupId, averageBrain, topPerformersCount);
    }

    waitForInitializationCompletion(newAgents);

    console.log('Restarting simulation with evolved agents!');

    if (increaseTimePerGen) {
        // simulationLengthModified += simulationLengthModified * 0.005;
        simulationLengthModified += 5;
    }

    // Reset simulation
    // await new Promise(resolve => setTimeout(resolve, 1000));
    displayedTimeLeft = (simulationLengthModified - tickCount) * (1 / simulationSpeed);
    stabilityCounter = 0;
    tickCount = 0;
    nextBatchFrame = 1;
    currentPhysicsBatch = 0;
    // p.loop();
    genCount++;
}

// Get the average weights accross the network.
//function calculateAllAverageDistances() {
//    let numAgents = agents.length;
//    if (numAgents === 0) {
//        throw new Error("No agents to calculate average weights");
//    }

//    let firstAgentWeights = agents[0].brain.getWeights().flatMap(tensor => Array.from(tensor.dataSync()));
//    let averageWeights = new Array(firstAgentWeights.length).fill(0);

//    agents.forEach(agent => {
//        let agentWeights = agent.brain.getWeights().flatMap(tensor => Array.from(tensor.dataSync()));

//        if (agentWeights.length !== firstAgentWeights.length) {
//            throw new Error("Agents have neural networks of different sizes");
//        }

//        for (let i = 0; i < agentWeights.length; i++) {
//            averageWeights[i] += agentWeights[i];
//        }
//    });

//    for (let i = 0; i < averageWeights.length; i++) {
//        averageWeights[i] /= numAgents;
//    }

//    return averageWeights;
//}

// Function to calculate the Euclidean distance of an agent's weights and biases to the population's average
//function distanceToAverage(agent, averageWeights) {
//    let agentWeights = agent.brain.getWeights().flatMap(tensor => Array.from(tensor.dataSync()));

//    if (agentWeights.length !== averageWeights.length) {
//        throw new Error("Agent has neural network of different size compared to population average");
//    }

//    let sum = 0;
//    for (let i = 0; i < agentWeights.length; i++) {
//        sum += Math.pow(agentWeights[i] - averageWeights[i], 2);
//    }

//    return Math.sqrt(sum);
//}

//// Update the mutation rate if NN's converge
//function updateMutationRate(oldRate, averageBrain) {
//    currentProcess = "Altering mutation rate if agents brains converge!";
//    let stdDevDistance = stdDevDistanceToAverageBrain(agents, averageBrain);

//    // Check if stdDevDistance is non-zero to avoid division by zero
//    if (stdDevDistance > 0) {
//        // Set the rate as the inverse of stdDevDistance, scaled by 1/40
//        newRate = 0.025 / stdDevDistance;

//        // Clamp the rate to be within [0.1, 0.4].  Should find a way to replace 0.1 with the users selection
//        newRate = Math.min(0.4, Math.max(0.1, newRate));
//    } else {
//        // If stdDevDistance is zero, it means all agents are identical, 
//        // so set a high mutation rate to increase diversity
//        newRate = 0.4;
//    }

//    console.log("Updated Mutation Rate: ", newRate, "Deviation Between Brains: ", stdDevDistance);
//    return newRate;
//}

//function stdDevDistanceToAverageBrain(allAgents, averageBrain) {
//    let distances = [];
//    let numAgents = allAgents.length;
//    let avgDistance = averageDistanceToAverageBrain(allAgents, averageBrain);

//    allAgents.forEach(agent => {
//        let distance = distanceToAverage(agent, averageBrain);
//        distances.push(Math.pow(distance - avgDistance, 2));
//    });

//    let sum = distances.reduce((a, b) => a + b, 0);
//    return Math.sqrt(sum / numAgents);
//}

//function averageDistanceToAverageBrain(allAgents, averageBrain) {
//    let sumDistance = 0;
//    let numAgents = allAgents.length;

//    allAgents.forEach(agent => {
//        sumDistance += distanceToAverage(agent, averageBrain);
//    });

//    return sumDistance / numAgents;
//}

// Create top performers for the next generation
function createTopPerformersNEAT(groupAgents, topPerformersCount, newAgents) {
    currentProcess = "Keeping top performers!";
    for (let j = 0; j < topPerformersCount; j++) {
        let oldAgent = groupAgents[j];
        usedIndices.add(oldAgent.index);
        let newAgent = new AgentNEAT(oldAgent.numLimbs, oldAgent.index, oldAgent.brain);
        let randomAngle = -Math.random() * Math.PI / 2;
        newAgent.mainBody.setAngle(randomAngle);
        newAgent.group = oldAgent.group;
        newAgents.push(newAgent);
    }
}

// Function to generate offspring for the next generation
function generateOffspringNEAT(groupAgents, newAgents, groupId, averageBrain, topPerformerNumber) {
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

                // childBrain.mutationRate = updateMutationRate(childBrain.mutationRate, averageBrain)

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
                let childAgent = new AgentNEAT(parent1.numLimbs, agentIndex);
                let randomAngle = -Math.random() * Math.PI / 2;
                childAgent.mainBody.setAngle(randomAngle);
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

//function selectAgent(agents, allAgents, excludedAgent = null) {
//    // Occasionally pick from the entire population
//    if (Math.random() < CROSS_GROUP_PROBABILITY) {
//        agents = allAgents;
//    }

//    // Tournament Selection
//    let tournamentContestants = [];

//    for (let i = 0; i < TOURNAMENT_SIZE; i++) {
//        let randomAgent;
//        do {
//            randomAgent = agents[Math.floor(Math.random() * agents.length)];
//        } while (tournamentContestants.includes(randomAgent) || randomAgent === excludedAgent);
//        tournamentContestants.push(randomAgent);
//    }

//    // Return the agent with the highest score from the tournament contestants
//    return tournamentContestants.sort((a, b) => b.getScore(true) - a.getScore(true))[0];
//}

//function selectAgentWeighted(agentsLocal, allAgents, excludedAgent = null) {
//    // Occasionally pick from the entire population
//    if (Math.random() < CROSS_GROUP_PROBABILITY) {
//        agentsLocal = allAgents;
//    }

//    let normalizedScores = [];
//    let minScore = Math.min(...agentsLocal.map(agent => agent.getScore(true)));

//    // Ensure all scores are positive
//    let offsetScore = minScore < 0 ? Math.abs(minScore) : 0;

//    let cumulativeSum = 0;
//    for (let agent of agentsLocal) {
//        if (agent !== excludedAgent) {
//            let score = agent.getScore(true) + offsetScore;
//            cumulativeSum += score;
//            normalizedScores.push(cumulativeSum);
//        }
//    }

//    let randomValue = Math.random() * cumulativeSum;
//    // If the random value is greater than the current iterated score, take that agent
//    for (let i = 0; i < normalizedScores.length; i++) {
//        if (randomValue <= normalizedScores[i]) {
//            return agentsLocal[i];
//        }
//    }
//    // Should not reach here, but just in case
//    return agentsLocal[0];
//}


//function crossover(agent1, agent2) {
//    let childBrain = createNeuralNetwork(agent1.nnConfig);
//    let newWeights = tf.tidy(() => {
//        let agent1Weights = agent1.brain.getWeights();
//        let agent2Weights = agent2.brain.getWeights();
//        let newWeightList = [];
//        for (let i = 0; i < agent1Weights.length; i++) {

//            let weight1 = agent1Weights[i];
//            let weight2 = agent2Weights[i];
//            let shape = weight1.shape;
//            let values1 = weight1.dataSync();
//            let values2 = weight2.dataSync();
//            let newValues = [];
//            for (let j = 0; j < values1.length; j++) {
//                if (Math.random() < 0.5) {
//                    newValues[j] = values1[j];
//                } else {
//                    newValues[j] = values2[j];
//                }
//            }
//            let newWeight = tf.tensor(newValues, shape);
//            newWeightList.push(newWeight);
//        }
//        return newWeightList;
//    });

//    childBrain.setWeights(newWeights);
//    newWeights.forEach(weight => weight.dispose()); // Dispose of these tensors manually.  Might not need as well as tf.tidy
//    return childBrain;
//}

//function biasedArithmeticCrossover(agent1, agent2) {
//    let childBrain = createNeuralNetwork(agent1.nnConfig);

//    let score1 = agent1.getScore(true)
//    let xScore1 = parseFloat(score1[0]);

//    let score2 = agent1.getScore(true)
//    let xScore2 = parseFloat(score2[0]);

//    let totalScore = xScore1 + xScore2;

//    // Normalize scores to get the bias for each parent.
//    let alpha = xScore1 / totalScore;
//    let beta = 1 - alpha; // or agent2.score / totalScore

//    let newWeights = tf.tidy(() => {
//        let agent1Weights = agent1.brain.getWeights();
//        let agent2Weights = agent2.brain.getWeights();
//        let newWeightList = [];
//        for (let i = 0; i < agent1Weights.length; i++) {
//            let weight1 = agent1Weights[i];
//            let weight2 = agent2Weights[i];
//            let newWeightValues = tf.add(tf.mul(weight1, alpha), tf.mul(weight2, beta));
//            newWeightList.push(newWeightValues);
//        }
//        return newWeightList;
//    });

//    childBrain.setWeights(newWeights);
//    newWeights.forEach(weight => weight.dispose()); // Dispose of these tensors manually. Might not need as well as tf.tidy
//    return childBrain;
//}

//// Some persentage of weights in a network should be changed by a random amount betwee -0.05 and 0.05
//function mutate(childBrain, mutationRate) {
//    tf.tidy(() => {
//        function mutateValues(values) {
//            for (let i = 0; i < values.length; i++) {
//                if (Math.random() < mutationRate) {
//                    let adjustment = (Math.random() - 0.5) * 0.1;  // Adjust by max +/- 0.05
//                    values[i] += adjustment;
//                }
//            }
//        }
//        let originalWeights = childBrain.getWeights();
//        let mutatedWeights = originalWeights.map(w => {
//            let values = w.arraySync();
//            mutateValues(values);
//            return tf.tensor(values);
//        });

//        childBrain.setWeights(mutatedWeights);
//        // Just dispose of mutatedWeights since originalWeights tensors have not been cloned or changed
//        mutatedWeights.forEach(w => w.dispose());
//    });
//    return childBrain; // Return the mutated childBrain
//}

//// Gaussian version of my mutate function, allowing for small randomised changes to weights
//function gaussianMutation(childBrain, mutationRate) {
//    let stdDeviation = 0.1;
//    tf.tidy(() => {
//        function mutateValues(values) {
//            // Handle nested arrays (2D, 3D, ...)
//            if (Array.isArray(values[0])) {
//                for (let i = 0; i < values.length; i++) {
//                    mutateValues(values[i]);
//                }
//            } else {
//                // 1D array
//                for (let i = 0; i < values.length; i++) {
//                    if (Math.random() < mutationRate) {
//                        let adjustment = randomGaussian(0, stdDeviation);
//                        values[i] += adjustment;
//                    }
//                }
//            }
//        }

//        function randomGaussian(mean, sd) {
//            // Using the Box-Muller transform to get a Gaussian random number
//            let u1 = Math.random();
//            let u2 = Math.random();
//            let randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
//            return mean + sd * randStdNormal;
//        }

//        let originalWeights = childBrain.getWeights();
//        let mutatedWeights = originalWeights.map(w => {
//            let values = w.arraySync();
//            mutateValues(values);
//            return tf.tensor(values);
//        });

//        childBrain.setWeights(mutatedWeights);
//        // Just dispose of mutatedWeights since originalWeights tensors have not been cloned or changed
//        mutatedWeights.forEach(w => w.dispose());
//    });
//    return childBrain; // Return the mutated childBrain
//}

//// If enabled, decay all weights in the brain by a small multiplier to encourage new solutions to emerge.  Might make this selective, or remove already low values completely (pruning)
//function decayWeights(brain, decayRate = 0.0001) {
//    return tf.tidy(() => {
//        let agentWeights = brain.getWeights();
//        let newWeights = [];

//        for (let tensor of agentWeights) {
//            let decayedTensor = tensor.mul(tf.scalar(1.0 - decayRate));
//            newWeights.push(decayedTensor);
//        }

//        brain.setWeights(newWeights);
//        return brain;
//    });
//}



//// Recursive function checking if agents have finished loading into world
//function waitForInitializationCompletion(newAgents) {
//    // Check if the condition is met
//    if (newAgents.length >= popSize) {
//        currentProcess = "New agents added to world!";

//        // Get a list of brains in the new generation
//        let newBrains = newAgents.map(agent => agent.brain);

//        isInitializationComplete = true;
//        // Dispose old agents
//        agents.forEach(agent => {
//            // Dispose the brain only if it's not being reused in the new generation
//            if (!newBrains.includes(agent.brain) && agent.brain) {
//                agent.brain.dispose();
//            }
//        });

//        agents = newAgents;

//        // Randomly select agents to render for each group
//        randomlySelectedAgents = [];
//        for (let groupId = 0; groupId < numGroups; groupId++) {

//            // Re-filter by group
//            groupAgents = agents.filter(agent => agent.group === groupId);

//            // Select few random agents
//            for (let i = 0; i < renderedAgents; i++) {
//                let randomIndex = Math.floor(Math.random() * groupAgents.length);
//                randomlySelectedAgents.push(groupAgents[randomIndex]);
//                // console.log("adding random agent to render list, group: " + groupId);
//            }
//        }

//        console.log('Number of tensors after restart:', tf.memory().numTensors, 'Tensor Mem after restart', tf.memory().numBytes);
//        console.log("Number of bodies:", world.getBodyCount());
//        console.log("Number of joints:", world.getJointCount());
//        offsetX = 0;

//    } else {
//        // If the condition is not met, wait for some time and check again
//        setTimeout(() => waitForInitializationCompletion(newAgents), 100); // Checking every 100ms for example
//    }
//}

function renderNeuralNetworkNEAT(p, nnConfig, agent, offsetX, offsetY, frameTracker) {
    let layerGap = 100; // horizontal space between layers
    let nodeGap = 30;   // vertical space between nodes
    let outputLabels = [];
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
        inputLabels = inputLabels.concat(Array(agent.numLimbs).fill(null).map((_, idx) => `Ground Sensor ${idx + 1}`));
    }

    if (inputsDistanceSensors) {
        for (let i = 0; i < 8; i++) {
            inputLabels.push(`Sensor ${['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'][i]}`);
        }
    }

    // + displayedTimeLeft.toFixed(0)
    // `Time Left: ${displayedTimeLeft.toFixed(0)} seconds`

    //if (frameTracker % 30 === 0) {

    // outputLabels = Array(nnConfig.outputNodes).fill(null).map((_, idx) => `Joint ${idx + 1}`);

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
                p.fill(GROUP_COLORS[agent.group]); // Default fill color
            //}

            let nodeSize = mapBiasToNodeSize(bias, maxBias);
            p.ellipse(x, y, nodeSize, nodeSize);
            p.stroke(0);
            // Add labels to the side of input and output nodes
            if (labels.length > 0) {
                p.textSize(12);
                if (i === 0) {
                    p.text(labels[j], x - 90, y + 4);
                } else if (i === nnConfig.hiddenLayers.length + 1) {
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
    p.strokeWeight(1); // Reset the default stroke weight
}

//function mapWeightToStroke(weight) {
//    let base = 7;  // High base power to emphasise stronger connections
//    let scaledWeight = Math.abs(weight);

//    // Using Math.pow to apply an exponential scale. 
//    return Math.pow(scaledWeight, base) * 400;
//}

//function mapBiasToNodeSize(bias) {
//    return 10 + Math.abs(bias) * 75; // 10 is base size, adjusting based on bias
//}

AgentNEAT.prototype.makeDecisionNEAT = function (inputs) {
    return tf.tidy(() => {
        const output = this.brain.predict(tf.tensor([inputs])).dataSync();
        let outputIndex = 0;

        for (let i = 0; i < this.joints.length; i++) {
            if (outputJointSpeed) {
                let adjustment = output[outputIndex] * MAX_ADJUSTMENT;
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

    if (inputsDistanceSensors) {
        // 8. Raycast distances to the closest obstacle in a few directions from the agent's body
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

        const MAX_DETECTION_DISTANCE = 200;  // Max distance of detection, can be adjusted

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

            // console.log(detectedDistance / MAX_DETECTION_DISTANCE);
            // Normalize detected distance and push to inputs
            inputs.push(detectedDistance / MAX_DETECTION_DISTANCE);
        }
    }



    // console.log("agent inputs: position: ", (position.x - this.startingX) / MAX_X, position.y / MAX_Y, "Velocity: ", velocity.x / MAX_VX, velocity.y / MAX_VY, this.mainBody.getAngle() / Math.PI, displayedTimeLeft / MAX_TIME)
    return inputs;
};


AgentNEAT.prototype.updateMusclesNEAT = function () {
    let inputs = this.collectInputsNEAT();
    this.makeDecisionNEAT(inputs);
    // this.muscleUpdateCount++;
};

AgentNEAT.prototype.renderNNNEAT = function (p, offsetX, offsetY, frameTracker) {
    renderNeuralNetworkNEAT(p, this.nnConfig, this, offsetX, offsetY, frameTracker);
};