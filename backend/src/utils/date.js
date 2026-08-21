const addDays = (date, days) => {
    const value = new Date(date);
    value.setDate(value.getDate() + days);
    return value;
};

module.exports = { addDays };
