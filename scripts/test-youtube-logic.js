
const urls = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // Clean
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share", // Extra param at end
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s", // Timestamp
    "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ", // Param before v (logic fails completely here)
    "https://youtu.be/dQw4w9WgXcQ", // Short
    "https://youtu.be/dQw4w9WgXcQ?t=10" // Short with param
];

function checkCurrentLogic(url) {
    let embedUrl = url;
    const isYouTube = url.includes('youtube') || url.includes('youtu.be');

    if (isYouTube) {
        if (url.includes('watch?v=')) {
            embedUrl = url.replace('watch?v=', 'embed/');
        } else if (url.includes('youtu.be/')) {
            embedUrl = url.replace('youtu.be/', 'youtube.com/embed/');
        }
    }
    return embedUrl;
}

function robustLogic(url) {
    let embedUrl = url;
    // Regex matches 11-char ID
    // Supports:
    // youtube.com/watch?v=ID
    // youtube.com/embed/ID
    // youtu.be/ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);

    if (match && match[2].length === 11) {
        embedUrl = `https://www.youtube.com/embed/${match[2]}`;
    }
    return embedUrl;
}

console.log("--- Testing Current Logic ---");
urls.forEach(url => {
    console.log(`Input:  ${url}`);
    console.log(`Output: ${checkCurrentLogic(url)}`);
    console.log("----------------");
});

console.log("\n--- Testing Robust Logic ---");
urls.forEach(url => {
    console.log(`Input:  ${url}`);
    console.log(`Output: ${robustLogic(url)}`);
    console.log("----------------");
});
