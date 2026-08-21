module.exports = ({ bodyFat, goal, bmi }) => {
    if (goal) {
        return goal;
    }

    if (typeof bodyFat === 'number' && bodyFat >= 25) {
        return 'fat loss';
    }

    if (typeof bmi === 'number' && bmi < 21) {
        return 'muscle gain';
    }

    return 'balanced';
};
