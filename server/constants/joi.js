const VALID = {
    regions: ['area1', 'area2', 'area3', 'area4'],
    roles: ['admin', 'customer'],
    slots: ['morning', 'afternoon', 'evening'],
    updateKey: ['username', 'email', 'phone', 'region', 'slot'],
}

const REGEX = {
    // email: /^[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/,
    email: /^(?=[^<>]*$)[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/,
    password: /^(?=[^<>]*$)(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,}$/, // Password must be at least 12 characters long, contain no < or > symbols, and include at least one uppercase letter, one lowercase letter, one number, and one special character
    disallowHtml: /^[^<>]*$/,
}

module.exports = {
    VALID,
    REGEX,
}