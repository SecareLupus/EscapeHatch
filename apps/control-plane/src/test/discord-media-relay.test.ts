import test from "node:test";
import assert from "node:assert/strict";
import { mapDiscordMediaToSkerryAttachments } from "../services/discord-bridge-service.js";

test("mapDiscordMediaToSkerryAttachments maps various media types correctly", () => {
    const input = [
        {
            url: "https://cdn.discordapp.com/attachments/123/456/image.gif",
            sourceUrl: "https://cdn.discordapp.com/attachments/123/456/image.gif",
            filename: "funny.gif"
        },
        {
            url: "https://cdn.discordapp.com/attachments/123/456/photo.jpg",
            sourceUrl: "https://cdn.discordapp.com/attachments/123/456/photo.jpg"
        },
        {
            url: "https://media.discordapp.net/stickers/789.png?size=240",
            sourceUrl: "https://discord.com/stickers/789.png",
            filename: "sticker.png",
            isSticker: true
        },
        {
            url: "https://cdn.discordapp.com/attachments/123/456/video.mp4",
            sourceUrl: "https://cdn.discordapp.com/attachments/123/456/video.mp4"
        }
    ];

    const results = mapDiscordMediaToSkerryAttachments(input);

    assert.strictEqual(results.length, 4);
    
    // GIF check
    assert.strictEqual(results[0].contentType, "image/gif");
    assert.ok(results[0].url.includes("media.discordapp.net"), "URL should be normalized to media proxy");
    
    // JPG check
    assert.strictEqual(results[1].contentType, "image/jpeg");
    assert.ok(results[1].url.includes("media.discordapp.net"), "URL should be normalized to media proxy");
    
    // Sticker check
    assert.strictEqual(results[2].contentType, "image/png");
    assert.ok(results[2].isSticker, "Should be marked as sticker");
    
    // Video check
    assert.strictEqual(results[3].contentType, "video/mp4");
});

test("mapDiscordMediaToSkerryAttachments handles HEIC correctly", () => {
    const input = [
        {
            url: "https://cdn.discordapp.com/attachments/123/456/photo.heic",
            sourceUrl: "https://cdn.discordapp.com/attachments/123/456/photo.heic"
        }
    ];

    const results = mapDiscordMediaToSkerryAttachments(input);
    assert.strictEqual(results[0].contentType, "image/webp");
    assert.ok(results[0].url.includes("format=webp"), "HEIC should be proxied as webp");
});
