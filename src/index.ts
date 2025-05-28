import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const server = new McpServer({
    name: "youngsMCP",
    version: "1.0.0",
    description: "A server that provides customer details from Young's Inc.",
    tools: [
        {
            name: "get-customer-details",
            description: "Get customer details by customer Number",
            parameters: {},
        },
    ],
});

const getCustomerDetails = server.tool(
    "get-customer-details",
    "Get customer details",
    async () => {
        // Simulate fetching customer details from a database or external service
        const response = await fetch(
            `https://www.youngsinc.com/yis7beta_service/api/config/getCustomerDetails/A024874`,
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        if (!response.ok) {
            throw new Error("Failed to fetch customer details");
        }

        const data = await response.json();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(data, null, 2),
                },
            ],
        };
    }
)

const app = express();
// app.use(express.json());

// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports: { [sessionId: string]: SSEServerTransport } = {};

app.get('/sse', async (req: Request, res: Response) => {
    // Get the full URI from the request
    const host = req.get("host");

    const fullUri = `https://${host}/messages`;
    const transport = new SSEServerTransport(fullUri, res);

    transports[transport.sessionId] = transport;
    res.on("close", () => {
        delete transports[transport.sessionId];
    });
    await server.connect(transport);
});

app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    if (transport) {
        await transport.handlePostMessage(req, res);
    } else {
        res.status(400).send("No transport found for sessionId");
    }
});

app.get("/", (_req, res) => {
    res.send("Youngs MCP server is running!");
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
