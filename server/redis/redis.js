const Redis = require("redis");
const redisClient = Redis.createClient();

redisClient.on("error", (err) => console.error("Redis Error:", err));

(async () => {
    await redisClient.connect();
    console.log("Connected to Redis.");
})();

const getOrSetCache = async (key, cb, exp = null) => {
    try {

        console.log(key);
        const data = await redisClient.get(key);

        console.log((data) ? `data: ${data}` : "Cache Miss");

        if (data != null) return (JSON.parse(data));

        const freshData = await cb();

        console.log((freshData) ? `fresh data: ${freshData}` : "Cache Hit");

        if (exp !== null) {

            await redisClient.setEx(key, exp, JSON.stringify(freshData));
        } else {

            await redisClient.set(key, JSON.stringify(freshData));
        }

        return freshData;

    } catch (err) {

        console.error("Redis error: ", err);
        throw new Error(`Redis err: ${err}`);

    }
}

const setCache = async (key, data, exp = null) => {
    try {

        if (exp !== null) {
            await redisClient.setEx(key, exp, JSON.stringify(data));
        } else {
            await redisClient.set(key, JSON.stringify(data));
        }

    } catch (err) {

        console.error("Redis error: ", err);
        throw new Error(`Redis err: ${err}`);

    }
}

const getCache = async (key) => {
    try {

        const data = await redisClient.get(key);
        if (data != null) {
            return JSON.parse(data);
        } else {
            return undefined
        }

    } catch (err) {

        console.error("Redis error: ", err);
        throw new Error(`Redis err: ${err}`);

    }
}

// updates: {
//     key1: newValue,
//     key2: newValue
// }

// updates:{
//     note:{
//         author: 'username',
//         message: 'message from author',
//     }
// }

const updateCache = async (key, updates, exp = null) => {
    try {

        let data = await getCache(key);

        if (data) {

            // updates.forEach(update => {
            //     if (update.key in data) {
            //         data[update.key] = update.value;
            //         console.log('updated');
            //     }
            // });

            if(updates.note){
                data.note ??= [];
                data.note.push(updates.note);
            } else {
                for (const [key, value] of Object.entries(updates)) {
                    if (key in data) {
                      data[key] = value;
                    }
                }

                // Object.entries(updates).forEach(([key, value])=>{if(key in data) data.key = value});
            }


        } else {

            throw new Error(`fetched data is undefined, data: ${data}`);

        }

        await setCache(key, data, exp);

        return data;

    } catch (err) {

        console.error("Redis error: ", err);
        throw new Error(`Redis err: ${err}`);

    }
}

const deleteCache = async (key)=>{
    await redisClient.del(key);
}

module.exports = { getOrSetCache, setCache, getCache, updateCache, deleteCache }