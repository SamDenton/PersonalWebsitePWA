window.drawParticles = function (particlePairs, particleCount) {
    const canvas = document.getElementById("particleCanvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    const particleRadius = 12;
    const angleStep = (2 * Math.PI) / particleCount;
    const particlePositions = [];

    // Calculate positions around a circle
    for (let i = 0; i < particleCount; i++) {
        const angle = i * angleStep;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        particlePositions.push({ x, y });
    }

    // Draw lines and display distances and binding energies between particles
    particlePairs.forEach(pair => {
        const particleA = particlePositions[pair.particleA - 1];
        const particleB = particlePositions[pair.particleB - 1];
        ctx.beginPath();
        ctx.moveTo(particleA.x, particleA.y);
        ctx.lineTo(particleB.x, particleB.y);
        ctx.strokeStyle = "white";
        ctx.stroke();

        // Convert distance and binding energy to scientific notation (E notation)
        const distanceText = pair.distance.toExponential(2).replace('e', 'E');
        const energyText = pair.bindingEnergy.toExponential(2).replace('e', 'E');

        ctx.fillStyle = "white"; // White labels for distances and binding energies
        ctx.font = "12px Arial";
        let midX = (particleA.x + particleB.x) / 2;
        let midY = (particleA.y + particleB.y) / 2;

        ctx.fillText(`r: ${distanceText} m`, midX - 20, midY + offsetY - 5);
        ctx.fillText(`u(r): ${energyText} J`, midX - 20, midY + offsetY + 10);
    });

    // Draw particles
    particlePositions.forEach((particle, index) => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particleRadius, 0, 2 * Math.PI);
        ctx.fillStyle = "blue";
        ctx.fill();
        ctx.fillStyle = "white"; // White labels
        ctx.font = "12px Arial";
        ctx.fillText(`P${index + 1}`, particle.x - particleRadius / 2, particle.y + particleRadius / 2);
    });
}
