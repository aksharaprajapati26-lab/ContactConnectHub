const app = require("./sever.js");

if (require.main === module) {
    const PORT = 4000;

    app.listen(PORT, () => {
        console.log("");
        console.log("======================================");
        console.log("     CONTACT CONNECT HUB");
        console.log("======================================");
        console.log("");
        console.log(`Server running at: http://localhost:${PORT}`);
        console.log(`Frontend:          http://localhost:${PORT}`);
        console.log(`API running at:    http://localhost:${PORT}/api`);
        console.log("");
    });
}

module.exports = app;
