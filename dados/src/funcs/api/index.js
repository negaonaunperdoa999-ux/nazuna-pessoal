import { ApiError, ErrorCodes, toUserMessage } from './errors.js';
import { runBrat } from './features/brat.js';
import { runYoutubeAudio, runYoutubeSearch, runYoutubeVideo } from './features/youtube.js';

const features = new Map([
    ['brat', runBrat],
    ['youtube.search', runYoutubeSearch],
    ['youtube.audio', runYoutubeAudio],
    ['youtube.video', runYoutubeVideo]
]);

export async function run(feature, input, options = {}) {
    const handler = features.get(feature);
    if (!handler) {
        throw new ApiError(ErrorCodes.UNSUPPORTED, {
            message: `Feature não suportada: ${feature}`
        });
    }

    return handler(input, options);
}

export {
    runBrat,
    ApiError,
    ErrorCodes,
    toUserMessage
};
