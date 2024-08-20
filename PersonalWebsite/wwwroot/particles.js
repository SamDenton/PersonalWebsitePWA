window.drawParticles = function (particlePairs, particleCount) {
    const canvas = document.getElementById("particleCanvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    const particleRadius = 1;
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
        const distanceText = pair.distance.toExponential(2);
        const energyText = pair.bindingEnergy.toExponential(2);

        ctx.fillStyle = "white"; // White labels for distances and binding energies
        ctx.font = "10px Arial";
        const midX = (particleA.x + particleB.x) / 2;
        const midY = (particleA.y + particleB.y) / 2;

        // Adjust text position if particle count is even to avoid overlap
        let offsetX = 0;
        let offsetY = 0;
        if (particleCount % 2 === 0) {
            const dx = particleB.x - particleA.x;
            const dy = particleB.y - particleA.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            offsetX = (dy / distance) * 10; // Move 10 units perpendicular to the line
            offsetY = -(dx / distance) * 10; // Adjust to avoid overlap
        }

        ctx.fillText(`R: ${distanceText} m`, midX + offsetX - 20, midY + offsetY - 20);
        ctx.fillText(`E: ${energyText} J`, midX + offsetX - 20, midY + offsetY - 5);
    });

    // Draw particles
    particlePositions.forEach((particle, index) => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particleRadius, 0, 2 * Math.PI);
        ctx.fillStyle = "blue";
        ctx.fill();
        ctx.fillStyle = "white"; // White labels
        ctx.font = "14px Arial";
        ctx.fillText(`P${index + 1}`, particle.x - particleRadius / 2, particle.y + particleRadius / 2);
    });
}
