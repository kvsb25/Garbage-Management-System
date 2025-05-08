const forRole = (role) => {

    let result = 'username email phone';
    
    if(role == 'admin'){
        result += ' region slot';
    }

    return result;

}

module.exports = {forRole}