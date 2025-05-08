const jwt = require('jsonwebtoken');
const ExpressError = require('./error');
const User = require('./database/model/user');
const redis = require('./redis/redis.js');
const constants = require('./constants');
const {forRole} = require('./utils/miscellaneous.js');

const verifyUser = (req, res, next) => {
    const token = req.signedCookies.token;
    if (!token) {throw new ExpressError(401, 'Unauthorized')}

    const user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

    if(user){
        req.user = redis.getOrSetCache(`${user.role}:${user._id}`, async ()=>{
            const data = await User.findOne({username: user.username}).select(forRole(user.role));
            return data;
        }, constants.redis.DEFAULT_EXPIRATION);
    } else {
        throw new ExpressError(401, 'Unauthorized');
    }
    
    return next();
}

const verifyRole = (role)=>{
    return (req, res, next)=>{
        if(req.user.role == role){
            return next();
        } else {
            throw new ExpressError(403, 'Forbidden');
        }
    }
}

module.exports = {
    verifyUser,
    verifyRole
}