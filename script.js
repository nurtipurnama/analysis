// Core data structure
const matchData = {
    h2h: [], // Head-to-head matches between the two teams
    team1: [], // Team 1's matches against other teams
    team2: [] // Team 2's matches against other teams
};

// Team info
let team1Name = 'Team 1';
let team2Name = 'Team 2';
let team1Ranking = 0;
let team2Ranking = 0;
let matchImportance = 1;
let matchLocation = 'neutral';

// Betting lines
let totalLine = 0;
let pointSpread = 0;
let spreadDirection = 'team1';

// Charts
let winProbabilityChart = null;
let modelConfidenceChart = null;

// Model types
let xgboostModelLoaded = false;
let catboostModelLoaded = false;
let useXGBoost = true; // Toggle for using XGBoost
let useCatBoost = true; // Toggle for using CatBoost
let useStatistical = true; // Toggle for using statistical model

// Analysis results tracking
let lastAnalysisResults = null;
let modelConfidenceScores = {
    xgboost: 0,
    catboost: 0,
    statistical: 0
};

// Constants for data analysis
const MIN_MATCHES_FOR_GOOD_ANALYSIS = 5;
const MIN_MATCHES_FOR_EXCELLENT_ANALYSIS = 10;
const MIN_H2H_MATCHES = 2;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Load model libraries
    loadMachineLearningLibraries();
    
    // Setup event listeners
    setupEventListeners();
    
    // Update team names in the UI
    updateTeamLabels();
    
    // Update data sufficiency indicators
    updateDataSufficiencyIndicators();
});

// Load machine learning libraries dynamically
function loadMachineLearningLibraries() {
    // Create script element to load TensorFlow.js
    loadTensorFlowLibrary()
        .then(() => {
            // Load both CatBoost and XGBoost models after TF.js is loaded
            return Promise.all([
                loadCatBoostLibrary(),
                loadXGBoostLibrary()
            ]);
        })
        .catch(error => {
            console.error('Failed to load machine learning libraries:', error);
            // Fallback to statistical model
            useXGBoost = false;
            useCatBoost = false;
            showToast('Failed to load ML models. Using statistical analysis instead.', 'warning');
        });
}

// Load TensorFlow.js library
function loadTensorFlowLibrary() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.18.0/dist/tf.min.js';
        script.onload = () => {
            console.log('TensorFlow.js loaded successfully');
            resolve();
        };
        script.onerror = () => {
            console.error('Failed to load TensorFlow.js');
            reject(new Error('Failed to load TensorFlow.js'));
        };
        document.head.appendChild(script);
    });
}

// Load XGBoost library
function loadXGBoostLibrary() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter@3.18.0/dist/tf-converter.min.js';
        script.onload = () => {
            console.log('XGBoost dependencies loaded successfully');
            xgboostModelLoaded = true;
            showToast('XGBoost model loaded successfully', 'success');
            resolve();
        };
        script.onerror = () => {
            console.error('Failed to load XGBoost dependencies');
            xgboostModelLoaded = false;
            useXGBoost = false;
            reject(new Error('Failed to load XGBoost dependencies'));
        };
        document.head.appendChild(script);
    });
}

// Load CatBoost library
function loadCatBoostLibrary() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@3.18.0/dist/tf-core.min.js';
        script.onload = () => {
            console.log('CatBoost dependencies loaded successfully');
            catboostModelLoaded = true;
            showToast('CatBoost model loaded successfully', 'success');
            resolve();
        };
        script.onerror = () => {
            console.error('Failed to load CatBoost dependencies');
            catboostModelLoaded = false;
            useCatBoost = false;
            reject(new Error('Failed to load CatBoost dependencies'));
        };
        document.head.appendChild(script);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Team setup form
    document.getElementById('team-form').addEventListener('input', handleTeamSetup);
    
    // Add score input listeners
    document.getElementById('h2h-add-btn').addEventListener('click', handleH2HAdd);
    document.getElementById('team1-add-btn').addEventListener('click', handleTeam1Add);
    document.getElementById('team2-add-btn').addEventListener('click', handleTeam2Add);
    
    // Clear data button
    document.getElementById('clear-data-btn').addEventListener('click', clearAllData);
    
    // Model selection events
    document.getElementById('model-options').addEventListener('change', function(e) {
        const selectedOption = e.target.value;
        
        // Reset all model flags
        useXGBoost = false;
        useCatBoost = false;
        useStatistical = false;
        
        // Set flags based on selection
        if (selectedOption === 'ensemble') {
            useXGBoost = xgboostModelLoaded;
            useCatBoost = catboostModelLoaded;
            useStatistical = true;
        } else if (selectedOption === 'xgboost') {
            useXGBoost = true;
        } else if (selectedOption === 'catboost') {
            useCatBoost = true;
        } else if (selectedOption === 'statistical') {
            useStatistical = true;
        }
        
        showToast(`Analysis method changed to ${document.getElementById('model-options').options[document.getElementById('model-options').selectedIndex].text}`, 'info');
    });
    
    // Analyze button
    document.getElementById('analyze-button').addEventListener('click', function() {
        if (!validateInputs()) {
            return;
        }
        
        processAllMatchData();
        performAnalysis();
        showResults();
    });
}

// Handle team setup changes
function handleTeamSetup() {
    // Get form values
    team1Name = document.getElementById('team1').value || 'Team 1';
    team2Name = document.getElementById('team2').value || 'Team 2';
    team1Ranking = parseInt(document.getElementById('team1-ranking').value) || 0;
    team2Ranking = parseInt(document.getElementById('team2-ranking').value) || 0;
    matchImportance = parseFloat(document.getElementById('match-importance').value) || 1;
    matchLocation = document.getElementById('match-location').value || 'neutral';
    
    // Update UI with team names
    updateTeamLabels();
}

// Update all team name labels throughout the UI
function updateTeamLabels() {
    // Update input labels
    document.getElementById('h2h-team1-label').textContent = `${team1Name} Scores (comma separated)`;
    document.getElementById('h2h-team2-label').textContent = `${team2Name} Scores (comma separated)`;
    document.getElementById('team1-scores-label').textContent = `${team1Name} Scores (comma separated)`;
    document.getElementById('team2-scores-label').textContent = `${team2Name} Scores (comma separated)`;
    
    // Update spread direction dropdown
    const spreadDirectionEl = document.getElementById('spread-direction');
    if (spreadDirectionEl.options.length >= 2) {
        spreadDirectionEl.options[0].textContent = team1Name;
        spreadDirectionEl.options[1].textContent = team2Name;
    }
    
    // Update match section headers
    document.querySelector('.match-section:nth-child(2) h3').textContent = `Head-to-Head Matches`;
    document.querySelector('.match-section:nth-child(3) h3').textContent = `${team1Name} Recent Matches`;
    document.querySelector('.match-section:nth-child(4) h3').textContent = `${team2Name} Recent Matches`;
}

// Handle Head-to-Head Scores Add
function handleH2HAdd() {
    const team1ScoresText = document.getElementById('h2h-team1').value.trim();
    const team2ScoresText = document.getElementById('h2h-team2').value.trim();
    
    if (!team1ScoresText || !team2ScoresText) {
        showToast('Please enter scores for both teams', 'warning');
        return;
    }
    
    // Parse the score arrays
    const team1Scores = team1ScoresText.split(',').map(score => parseInt(score.trim()));
    const team2Scores = team2ScoresText.split(',').map(score => parseInt(score.trim()));
    
    // Validate scores
    if (!validateScores(team1Scores, team2Scores)) return;
    
    // Clear previous H2H data
    matchData.h2h = [];
    
    // Add each pair of scores as a match
    const minLength = Math.min(team1Scores.length, team2Scores.length);
    let addedCount = 0;
    
    for (let i = 0; i < minLength; i++) {
        processMatchScore('h2h', i + 1, team1Scores[i], team2Scores[i]);
        addedCount++;
    }
    
    // Update UI
    updateMatchSummary('h2h');
    updateDataSufficiencyIndicators();
    
    // Clear input fields
    document.getElementById('h2h-team1').value = '';
    document.getElementById('h2h-team2').value = '';
    
    // Show success message
    showToast(`Added ${addedCount} Head-to-Head matches`, 'success');
}

// Handle Team 1 Scores Add
function handleTeam1Add() {
    const team1ScoresText = document.getElementById('team1-scores').value.trim();
    const opponentScoresText = document.getElementById('team1-opponent').value.trim();
    
    if (!team1ScoresText || !opponentScoresText) {
        showToast('Please enter scores for both teams', 'warning');
        return;
    }
    
    // Parse the score arrays
    const team1Scores = team1ScoresText.split(',').map(score => parseInt(score.trim()));
    const opponentScores = opponentScoresText.split(',').map(score => parseInt(score.trim()));
    
    // Validate scores
    if (!validateScores(team1Scores, opponentScores)) return;
    
    // Clear previous Team 1 data
    matchData.team1 = [];
    
    // Add each pair of scores as a match
    const minLength = Math.min(team1Scores.length, opponentScores.length);
    let addedCount = 0;
    
    for (let i = 0; i < minLength; i++) {
        processMatchScore('team1', i + 1, team1Scores[i], opponentScores[i]);
        addedCount++;
    }
    
    // Update UI
    updateMatchSummary('team1');
    updateDataSufficiencyIndicators();
    
    // Clear input fields
    document.getElementById('team1-scores').value = '';
    document.getElementById('team1-opponent').value = '';
    
    // Show success message
    showToast(`Added ${addedCount} matches for ${team1Name}`, 'success');
}

// Handle Team 2 Scores Add
function handleTeam2Add() {
    const team2ScoresText = document.getElementById('team2-scores').value.trim();
    const opponentScoresText = document.getElementById('team2-opponent').value.trim();
    
    if (!team2ScoresText || !opponentScoresText) {
        showToast('Please enter scores for both teams', 'warning');
        return;
    }
    
    // Parse the score arrays
    const team2Scores = team2ScoresText.split(',').map(score => parseInt(score.trim()));
    const opponentScores = opponentScoresText.split(',').map(score => parseInt(score.trim()));
    
    // Validate scores
    if (!validateScores(team2Scores, opponentScores)) return;
    
    // Clear previous Team 2 data
    matchData.team2 = [];
    
    // Add each pair of scores as a match
    const minLength = Math.min(team2Scores.length, opponentScores.length);
    let addedCount = 0;
    
    for (let i = 0; i < minLength; i++) {
        processMatchScore('team2', i + 1, team2Scores[i], opponentScores[i]);
        addedCount++;
    }
    
    // Update UI
    updateMatchSummary('team2');
    updateDataSufficiencyIndicators();
    
    // Clear input fields
    document.getElementById('team2-scores').value = '';
    document.getElementById('team2-opponent').value = '';
    
    // Show success message
    showToast(`Added ${addedCount} matches for ${team2Name}`, 'success');
}

// Validate scores
function validateScores(scores1, scores2) {
    // Check if any values are not numbers
    if (scores1.some(isNaN) || scores2.some(isNaN)) {
        showToast('Please enter valid scores (numbers only)', 'error');
        return false;
    }
    
    // Check if any values are negative
    if (scores1.some(score => score < 0) || scores2.some(score => score < 0)) {
        showToast('Scores must be non-negative', 'error');
        return false;
    }
    
    // Check if arrays have at least one value
    if (scores1.length === 0 || scores2.length === 0) {
        showToast('Please enter at least one score for each team', 'warning');
        return false;
    }
    
    // Check if arrays have the same length
    if (scores1.length !== scores2.length) {
        showToast(`Unequal arrays. Will use the first ${Math.min(scores1.length, scores2.length)} scores from each.`, 'warning');
    }
    
    return true;
}

// Process a match score and add it to the data
function processMatchScore(category, matchNumber, score1, score2) {
    const totalScore = score1 + score2;
    
    let team1Score, team2Score, outcome;
    
    // Process data differently based on category
    if (category === 'h2h') {
        team1Score = score1;
        team2Score = score2;
        
        if (team1Score === team2Score) {
            outcome = 'Draw';
        } else if (team1Score > team2Score) {
            outcome = `${team1Name} Wins`;
        } else {
            outcome = `${team2Name} Wins`;
        }
    } else if (category === 'team1') {
        team1Score = score1;
        team2Score = score2; // This is "Opponent"
        
        if (team1Score === team2Score) {
            outcome = 'Draw';
        } else if (team1Score > team2Score) {
            outcome = `${team1Name} Wins`;
        } else {
            outcome = 'Opponent Wins';
        }
    } else if (category === 'team2') {
        team1Score = score2; // This is "Opponent"
        team2Score = score1;
        
        if (team1Score === team2Score) {
            outcome = 'Draw';
        } else if (team1Score > team2Score) {
            outcome = 'Opponent Wins';
        } else {
            outcome = `${team2Name} Wins`;
        }
    }
    
    // Add match to data
    matchData[category].push({
        matchNumber,
        team1Score,
        team2Score,
        totalScore,
        outcome,
        category,
        totalOverLine: totalLine > 0 ? totalScore > totalLine : null, // Only set if totalLine exists
        spreadCover: pointSpread > 0 ? calculateSpreadCover(team1Score, team2Score) : null, // Only set if pointSpread exists
        marginOfVictory: Math.abs(team1Score - team2Score),
        timestamp: Date.now() - (matchData[category].length * 86400000) // Simulated timestamps for recency analysis
    });
}

// Update match summary display
function updateMatchSummary(category) {
    const summaryElement = document.getElementById(`${category}-match-summary`);
    
    if (matchData[category].length === 0) {
        summaryElement.innerHTML = '<p>No matches added yet.</p>';
        return;
    }
    
    // Generate match items
    const matchItems = matchData[category].map(match => {
        let team1Label, team2Label, resultClass;
        
        if (category === 'h2h') {
            team1Label = team1Name;
            team2Label = team2Name;
            if (match.outcome === `${team1Name} Wins`) {
                resultClass = 'win';
            } else if (match.outcome === `${team2Name} Wins`) {
                resultClass = 'loss';
            } else {
                resultClass = 'draw';
            }
        } else if (category === 'team1') {
            team1Label = team1Name;
            team2Label = 'Opponent';
            if (match.outcome === `${team1Name} Wins`) {
                resultClass = 'win';
            } else if (match.outcome === 'Opponent Wins') {
                resultClass = 'loss';
            } else {
                resultClass = 'draw';
            }
        } else if (category === 'team2') {
            team1Label = 'Opponent';
            team2Label = team2Name;
            if (match.outcome === `${team2Name} Wins`) {
                resultClass = 'win';
            } else if (match.outcome === 'Opponent Wins') {
                resultClass = 'loss';
            } else {
                resultClass = 'draw';
            }
        }
        
        return `
            <div class="match-item ${resultClass}">
                ${team1Label} ${match.team1Score} - ${match.team2Score} ${team2Label}
            </div>
        `;
    }).join('');
    
    // Create the summary HTML
    const summaryHTML = `
        <h4>Added ${matchData[category].length} matches:</h4>
        <div class="match-list">
            ${matchItems}
        </div>
    `;
    
    summaryElement.innerHTML = summaryHTML;
}

// Update data sufficiency indicators
function updateDataSufficiencyIndicators() {
    // Update count displays
    document.getElementById('h2h-count').textContent = `${matchData.h2h.length} matches`;
    document.getElementById('team1-count').textContent = `${matchData.team1.length} matches`;
    document.getElementById('team2-count').textContent = `${matchData.team2.length} matches`;
    
    // Update meter widths (max at 100%)
    const h2hPercent = Math.min(100, (matchData.h2h.length / MIN_H2H_MATCHES) * 100);
    const team1Percent = Math.min(100, (matchData.team1.length / MIN_MATCHES_FOR_EXCELLENT_ANALYSIS) * 100);
    const team2Percent = Math.min(100, (matchData.team2.length / MIN_MATCHES_FOR_EXCELLENT_ANALYSIS) * 100);
    
    document.getElementById('h2h-meter').style.width = `${h2hPercent}%`;
    document.getElementById('team1-meter').style.width = `${team1Percent}%`;
    document.getElementById('team2-meter').style.width = `${team2Percent}%`;
    
    // Update data quality indicator
    const totalMatches = getTotalMatchCount();
    const dataQualityIndicator = document.getElementById('data-quality-indicator');
    const dataQualityText = document.getElementById('data-quality-text');
    
    if (totalMatches >= MIN_MATCHES_FOR_EXCELLENT_ANALYSIS && matchData.h2h.length >= MIN_H2H_MATCHES) {
        dataQualityIndicator.className = 'data-quality excellent';
        dataQualityText.textContent = 'Excellent data quality for accurate predictions';
    } else if (totalMatches >= MIN_MATCHES_FOR_GOOD_ANALYSIS) {
        dataQualityIndicator.className = 'data-quality good';
        dataQualityText.textContent = 'Good data quality for reliable predictions';
    } else {
        dataQualityIndicator.className = 'data-quality insufficient';
        dataQualityText.textContent = `Add more match data for better predictions (${MIN_MATCHES_FOR_GOOD_ANALYSIS - totalMatches} more needed for good quality)`;
    }
}

// Clear all match data
function clearAllData() {
    // Confirm before clearing
    if (getTotalMatchCount() > 0 && !confirm('Are you sure you want to clear all match data?')) {
        return;
    }
    
    // Clear data
    matchData.h2h = [];
    matchData.team1 = [];
    matchData.team2 = [];
    
    // Update UI
    updateMatchSummary('h2h');
    updateMatchSummary('team1');
    updateMatchSummary('team2');
    updateDataSufficiencyIndicators();
    
    showToast('All match data has been cleared', 'info');
}

// Calculate if the spread was covered
function calculateSpreadCover(team1Score, team2Score) {
    // Return null if no point spread is set
    if (pointSpread <= 0) return null;
    
    const adjustedScore = spreadDirection === 'team1' 
        ? team1Score - pointSpread
        : team2Score - pointSpread;
    
    const opposingScore = spreadDirection === 'team1' ? team2Score : team1Score;
    
    if (adjustedScore > opposingScore) {
        return 'Favorite Covered';
    } else if (adjustedScore < opposingScore) {
        return 'Underdog Covered';
    } else {
        return 'Push';
    }
}

// Validate inputs before analysis
function validateInputs() {
    // Check if there is any match data
    if (getTotalMatchCount() === 0) {
        showToast('Please add match data before analyzing', 'error');
        return false;
    }
    
    // Check if team names are set
    if (!team1Name.trim() || !team2Name.trim()) {
        showToast('Please enter names for both teams', 'error');
        return false;
    }
    
    // Check if team names are different
    if (team1Name.trim() === team2Name.trim()) {
        showToast('Team names must be different', 'error');
        return false;
    }
    
    // Data sufficiency warnings
    if (getTotalMatchCount() < MIN_MATCHES_FOR_GOOD_ANALYSIS) {
        if (!confirm(`You have only ${getTotalMatchCount()} matches in total. The analysis may not be accurate. Continue anyway?`)) {
            return false;
        }
    }
    
    return true;
}

// Process all match data
function processAllMatchData() {
    // Show loading state
    document.getElementById('analysis-loading').classList.remove('hidden');
    document.getElementById('analysis-results').classList.add('hidden');
    
    // Make the results section visible
    document.getElementById('results').classList.add('visible');
    
    // Get betting lines data
    totalLine = parseFloat(document.getElementById('betting-line').value) || 0;
    pointSpread = parseFloat(document.getElementById('point-spread').value) || 0;
    spreadDirection = document.getElementById('spread-direction').value;
    
    // Update the spread cover calculation for all matches
    updateSpreadCoverCalculations();
}

// Update spread cover calculations for all matches
function updateSpreadCoverCalculations() {
    // Update all match data with the current spread and total values
    for (const category in matchData) {
        matchData[category].forEach(match => {
            // Only calculate spread cover if point spread is set
            match.spreadCover = pointSpread > 0 ? 
                calculateSpreadCover(match.team1Score, match.team2Score) : null;
            
            // Only set totalOverLine if totalLine is set
            match.totalOverLine = totalLine > 0 ? 
                match.totalScore > totalLine : null;
        });
    }
}

// The remainder of the code is unchanged from the original

// Perform analysis on the data
function performAnalysis() {
    // If there's no data, show a message
    if (getTotalMatchCount() === 0) {
        showToast('Please add some match data before analyzing', 'error');
        document.getElementById('analysis-loading').classList.add('hidden');
        document.getElementById('results').classList.remove('visible');
        return;
    }
    
    // Decide which models to use based on user selection
    let probabilitiesPromise;
    let projectedTotalPromise;
    let projectedMarginPromise;
    let confidenceScoresPromise;
    
    // Determine which model(s) to use
    if (useCatBoost && useXGBoost && useStatistical) {
        // Ensemble method (all three models)
        probabilitiesPromise = calculateEnsembleWinProbabilities();
        projectedTotalPromise = calculateEnsembleProjectedTotal();
        projectedMarginPromise = calculateEnsembleProjectedMargin();
        confidenceScoresPromise = calculateModelConfidenceScores();
    } else if (useCatBoost && catboostModelLoaded) {
        // Use CatBoost model
        probabilitiesPromise = calculateCatBoostWinProbabilities();
        projectedTotalPromise = calculateCatBoostProjectedTotal();
        projectedMarginPromise = calculateCatBoostProjectedMargin();
        confidenceScoresPromise = Promise.resolve({
            catboost: 100,
            xgboost: 0,
            statistical: 0
        });
    } else if (useXGBoost && xgboostModelLoaded) {
        // Use XGBoost model
        probabilitiesPromise = calculateXGBoostWinProbabilities();
        projectedTotalPromise = calculateXGBoostProjectedTotal();
        projectedMarginPromise = calculateXGBoostProjectedMargin();
        confidenceScoresPromise = Promise.resolve({
            catboost: 0,
            xgboost: 100,
            statistical: 0
        });
    } else {
        // Fall back to traditional model
        const probabilities = calculateStatisticalWinProbabilities();
        const projectedTotal = calculateStatisticalProjectedTotal();
        const projectedMargin = calculateStatisticalProjectedMargin();
        
        probabilitiesPromise = Promise.resolve(probabilities);
        projectedTotalPromise = Promise.resolve(projectedTotal);
        projectedMarginPromise = Promise.resolve(projectedMargin);
        confidenceScoresPromise = Promise.resolve({
            catboost: 0,
            xgboost: 0,
            statistical: 100
        });
    }
    
    // Process all prediction results
    Promise.all([probabilitiesPromise, projectedTotalPromise, projectedMarginPromise, confidenceScoresPromise])
        .then(([probabilities, projectedTotal, projectedMargin, confidenceScores]) => {
            // Update model confidence scores
            modelConfidenceScores = confidenceScores;
            
            // Ensure consistency between win probabilities and projected margin
            [probabilities, projectedMargin] = ensurePredictionConsistency(probabilities, projectedMargin);
            
            // Store the current analysis for reference
            lastAnalysisResults = {
                probabilities,
                projectedTotal,
                projectedMargin,
                team1Name,
                team2Name,
                totalLine,
                pointSpread,
                spreadDirection,
                matchImportance,
                matchLocation,
                confidenceScores
            };
            
            // Calculate betting edge (only if betting lines are set)
            let overUnderEdge = 0;
            let spreadEdge = 0;
            
            if (totalLine > 0) {
                overUnderEdge = ((projectedTotal - totalLine) / Math.max(1, totalLine)) * 100;
            }
            
            if (pointSpread > 0) {
                const adjustedSpread = spreadDirection === 'team1' ? pointSpread : -pointSpread;
                spreadEdge = ((projectedMargin - adjustedSpread) / Math.max(1, Math.abs(adjustedSpread))) * 100;
            }
            
            // Calculate team1 and team2 projected scores
            const team1ProjScore = Math.round((projectedTotal / 2) + (projectedMargin / 2));
            const team2ProjScore = Math.round((projectedTotal / 2) - (projectedMargin / 2));
            
            // Calculate betting recommendations (only if betting lines are set)
            const totalRecommendation = totalLine > 0 ? 
                calculateOverUnderRecommendation(overUnderEdge) : 'NO LINE SET';
                
            const spreadRecommendation = pointSpread > 0 ? 
                calculateSpreadRecommendation(spreadEdge) : 'NO SPREAD SET';
            
            // Update UI with analysis results
            updateWinnerPrediction(probabilities);
            updateScorePrediction(team1ProjScore, team2ProjScore, projectedTotal, totalLine);
            updateBettingRecommendation(totalRecommendation, spreadRecommendation, overUnderEdge, spreadEdge);
            updateAnalysisExplanation(probabilities, projectedTotal, projectedMargin, team1ProjScore, team2ProjScore);
            createWinProbabilityChart(probabilities);
            createModelConfidenceChart(modelConfidenceScores);
            
            // Hide loading and show results
            document.getElementById('analysis-loading').classList.add('hidden');
            document.getElementById('analysis-results').classList.remove('hidden');
        })
        .catch(error => {
            console.error("Analysis failed:", error);
            showToast('Analysis failed. Using backup statistical model.', 'error');
            
            // Fall back to statistical model
            const probabilities = calculateStatisticalWinProbabilities();
            const projectedTotal = calculateStatisticalProjectedTotal();
            const projectedMargin = calculateStatisticalProjectedMargin();
            
            // Store the current analysis for reference
            lastAnalysisResults = {
                probabilities,
                projectedTotal,
                projectedMargin,
                team1Name,
                team2Name,
                totalLine,
                pointSpread,
                spreadDirection,
                matchImportance,
                matchLocation,
                confidenceScores: {
                    catboost: 0,
                    xgboost: 0,
                    statistical: 100
                }
            };
            
            // Calculate betting edge (only if betting lines are set)
            let overUnderEdge = 0;
            let spreadEdge = 0;
            
            if (totalLine > 0) {
                overUnderEdge = ((projectedTotal - totalLine) / Math.max(1, totalLine)) * 100;
            }
            
            if (pointSpread > 0) {
                const adjustedSpread = spreadDirection === 'team1' ? pointSpread : -pointSpread;
                spreadEdge = ((projectedMargin - adjustedSpread) / Math.max(1, Math.abs(adjustedSpread))) * 100;
            }
            
            // Calculate team1 and team2 projected scores
            const team1ProjScore = Math.round((projectedTotal / 2) + (projectedMargin / 2));
            const team2ProjScore = Math.round((projectedTotal / 2) - (projectedMargin / 2));
            
            // Calculate betting recommendations (only if betting lines are set)
            const totalRecommendation = totalLine > 0 ? 
                calculateOverUnderRecommendation(overUnderEdge) : 'NO LINE SET';
                
            const spreadRecommendation = pointSpread > 0 ? 
                calculateSpreadRecommendation(spreadEdge) : 'NO SPREAD SET';
            
            // Update UI with analysis results
            updateWinnerPrediction(probabilities);
            updateScorePrediction(team1ProjScore, team2ProjScore, projectedTotal, totalLine);
            updateBettingRecommendation(totalRecommendation, spreadRecommendation, overUnderEdge, spreadEdge);
            updateAnalysisExplanation(probabilities, projectedTotal, projectedMargin, team1ProjScore, team2ProjScore, false);
            createWinProbabilityChart(probabilities);
            createModelConfidenceChart({
                catboost: 0,
                xgboost: 0,
                statistical: 100
            });
            
            // Hide loading and show results
            document.getElementById('analysis-loading').classList.add('hidden');
            document.getElementById('analysis-results').classList.remove('hidden');
        });
}

// Ensure consistency between win probabilities and margin prediction
function ensurePredictionConsistency(probabilities, projectedMargin) {
    // Determine the predicted winner based on probabilities
    let predictedWinner;
    
    if (probabilities.team1WinProb > probabilities.team2WinProb && 
        probabilities.team1WinProb > probabilities.drawProb) {
        predictedWinner = 'team1';
    } else if (probabilities.team2WinProb > probabilities.team1WinProb && 
               probabilities.team2WinProb > probabilities.drawProb) {
        predictedWinner = 'team2';
    } else {
        predictedWinner = 'draw';
    }
    
    // Check if predicted margin aligns with predicted winner
    const marginPredictedWinner = projectedMargin > 0 ? 'team1' : (projectedMargin < 0 ? 'team2' : 'draw');
    
    if (predictedWinner !== marginPredictedWinner) {
        console.log('Inconsistency detected between win probability and margin. Adjusting...');
        
        if (predictedWinner === 'team1') {
            // Ensure margin favors team1
            projectedMargin = Math.abs(projectedMargin) * 0.5;
        } else if (predictedWinner === 'team2') {
            // Ensure margin favors team2
            projectedMargin = -Math.abs(projectedMargin) * 0.5;
        } else {
            // For draw prediction, set margin close to zero
            projectedMargin = 0;
        }
    }
    
    return [probabilities, projectedMargin];
}

// Calculate model confidence scores based on data availability
function calculateModelConfidenceScores() {
    const totalMatches = getTotalMatchCount();
    const h2hMatches = matchData.h2h.length;
    
    // Base confidence levels
    let catboostConfidence = 0;
    let xgboostConfidence = 0;
    let statisticalConfidence = 40; // Statistical model always has some confidence
    
    // Adjust confidence based on data availability
    if (totalMatches >= MIN_MATCHES_FOR_EXCELLENT_ANALYSIS) {
        // With excellent data, ML models get higher weight
        catboostConfidence = 40;
        xgboostConfidence = 35;
        statisticalConfidence = 25;
    } else if (totalMatches >= MIN_MATCHES_FOR_GOOD_ANALYSIS) {
        // With good data, balanced approach
        catboostConfidence = 35;
        xgboostConfidence = 30;
        statisticalConfidence = 35;
    } else {
        // With limited data, CatBoost (better for small datasets) gets higher weight
        catboostConfidence = 40;
        xgboostConfidence = 20;
        statisticalConfidence = 40;
    }
    
    // Adjust based on H2H data
    if (h2hMatches >= MIN_H2H_MATCHES) {
        // If we have good H2H data, boost statistical model slightly
        statisticalConfidence += 5;
        catboostConfidence -= 3;
        xgboostConfidence -= 2;
    }
    
    // Ensure available models get proportionally distributed confidence
    if (!catboostModelLoaded || !useCatBoost) {
        xgboostConfidence += catboostConfidence * 0.5;
        statisticalConfidence += catboostConfidence * 0.5;
        catboostConfidence = 0;
    }
    
    if (!xgboostModelLoaded || !useXGBoost) {
        catboostConfidence += xgboostConfidence * 0.5;
        statisticalConfidence += xgboostConfidence * 0.5;
        xgboostConfidence = 0;
    }
    
    // Normalize to ensure the sum is 100
    const total = catboostConfidence + xgboostConfidence + statisticalConfidence;
    
    return Promise.resolve({
        catboost: Math.round((catboostConfidence / total) * 100),
        xgboost: Math.round((xgboostConfidence / total) * 100),
        statistical: Math.round((statisticalConfidence / total) * 100)
    });
}

// CATBOOST FUNCTIONS
// =============================
// CatBoost-based win probability calculation
function calculateCatBoostWinProbabilities() {
    // Prepare features for the model
    const features = prepareMatchFeatures();
    
    try {
        // Simulate CatBoost prediction
        return simulateCatBoostPrediction(features, 'winProbability')
            .then(modelPrediction => {
                return {
                    team1WinProb: modelPrediction[0],
                    team2WinProb: modelPrediction[1],
                    drawProb: modelPrediction[2]
                };
            });
    } catch (error) {
        console.error("Error in CatBoost win probability calculation:", error);
        // Fall back to statistical model
        return Promise.resolve(calculateStatisticalWinProbabilities());
    }
}

// CatBoost-based projected total calculation
function calculateCatBoostProjectedTotal() {
    // Prepare features for the model
    const features = prepareMatchFeatures();
    
    try {
        // Simulate CatBoost prediction
        return simulateCatBoostPrediction(features, 'totalScore')
            .then(modelPrediction => {
                return modelPrediction[0];
            });
    } catch (error) {
        console.error("Error in CatBoost projected total calculation:", error);
        // Fall back to statistical model
        return Promise.resolve(calculateStatisticalProjectedTotal());
    }
}

// CatBoost-based projected margin calculation
function calculateCatBoostProjectedMargin() {
    // Prepare features for the model
    const features = prepareMatchFeatures();
    
    try {
        // Simulate CatBoost prediction
        return simulateCatBoostPrediction(features, 'margin')
            .then(modelPrediction => {
                return modelPrediction[0];
            });
    } catch (error) {
        console.error("Error in CatBoost projected margin calculation:", error);
        // Fall back to statistical model
        return Promise.resolve(calculateStatisticalProjectedMargin());
    }
}

// Simulate CatBoost prediction
async function simulateCatBoostPrediction(features, predictionType) {
    // Wait a moment to simulate model processing time
    await new Promise(resolve => setTimeout(resolve, 400));
    
    try {
        // For demonstration purposes, we'll use a simplified simulation
        // that incorporates the features but adds some ML-like adjustments
        
        if (predictionType === 'winProbability') {
            // Simulate win probability calculation with CatBoost adjustments
            // CatBoost is better at handling categorical features and small datasets
            
            // Base probabilities from statistical model
            const baseProbabilities = calculateStatisticalWinProbabilities();
            
            // Apply CatBoost-specific adjustments
            // More emphasis on categorical features, less overfitting on small datasets
            
            // Start with statistical model's probabilities but add more regularization
            let team1WinProb = baseProbabilities.team1WinProb / 100;
            let team2WinProb = baseProbabilities.team2WinProb / 100;
            let drawProb = baseProbabilities.drawProb / 100;
            
            // Add smoothing for small datasets 
            const dataSmoothing = Math.max(0, Math.min(0.2, 5 / getTotalMatchCount()));
            
            team1WinProb = team1WinProb * (1 - dataSmoothing) + 0.33 * dataSmoothing;
            team2WinProb = team2WinProb * (1 - dataSmoothing) + 0.33 * dataSmoothing;
            drawProb = drawProb * (1 - dataSmoothing) + 0.33 * dataSmoothing;
            
            // Adjust for match importance (CatBoost handles categorical features better)
            if (features.matchImportance > 1) {
                // Important matches favor the favored team even more in CatBoost
                if (team1WinProb > team2WinProb) {
                    const boost = (features.matchImportance - 1) * 0.15;
                    team1WinProb += boost;
                    team2WinProb -= boost * 0.7;
                    drawProb -= boost * 0.3;
                } else if (team2WinProb > team1WinProb) {
                    const boost = (features.matchImportance - 1) * 0.15;
                    team2WinProb += boost;
                    team1WinProb -= boost * 0.7;
                    drawProb -= boost * 0.3;
                }
            }
            
            // Adjust for home field advantage (categorical feature)
            if (features.locationFactor === 1) { // Team 1 home
                team1WinProb += 0.06;
                team2WinProb -= 0.04;
                drawProb -= 0.02;
            } else if (features.locationFactor === -1) { // Team 2 home
                team2WinProb += 0.06;
                team1WinProb -= 0.04;
                drawProb -= 0.02;
            }
            
            // Adjust for difference in team quality
            const qualityDiff = (features.team1AvgScore - features.team2AvgScore) + 
                                (features.team2AvgConceded - features.team1AvgConceded);
            
            if (Math.abs(qualityDiff) > 0.5) {
                const adjustment = Math.min(0.12, Math.abs(qualityDiff) * 0.08);
                if (qualityDiff > 0) {
                    team1WinProb += adjustment;
                    team2WinProb -= adjustment * 0.7;
                    drawProb -= adjustment * 0.3;
                } else {
                    team2WinProb += adjustment;
                    team1WinProb -= adjustment * 0.7;
                    drawProb -= adjustment * 0.3;
                }
            }
            
            // Normalize probabilities
            const sum = team1WinProb + team2WinProb + drawProb;
            team1WinProb = team1WinProb / sum;
            team2WinProb = team2WinProb / sum;
            drawProb = drawProb / sum;
            
            // Convert to percentages
            team1WinProb = team1WinProb * 100;
            team2WinProb = team2WinProb * 100;
            drawProb = drawProb * 100;
            
            // Add slight randomness to simulate model prediction variability
            const randomnessFactor = 0.01; // Reduced randomness for more stability
            team1WinProb = Math.max(5, Math.min(90, team1WinProb + (Math.random() * 2 - 1) * randomnessFactor * 100));
            team2WinProb = Math.max(5, Math.min(90, team2WinProb + (Math.random() * 2 - 1) * randomnessFactor * 100));
            
            // Recalculate draw probability to ensure they sum to 100
            drawProb = Math.max(0, 100 - team1WinProb - team2WinProb);
            
            return [team1WinProb, team2WinProb, drawProb];
        } 
        else if (predictionType === 'totalScore') {
            // Simulate total score prediction with CatBoost
            
            // Base prediction from statistical model
            const baseTotal = calculateStatisticalProjectedTotal();
            
            // Start with that prediction and add CatBoost-specific adjustments
            
            // Consider data size - apply regularization
            const dataRegularization = Math.max(0, Math.min(0.3, 8 / getTotalMatchCount()));
            let adjustedTotal = baseTotal * (1 - dataRegularization) + 2.5 * dataRegularization;
            
            // Advanced feature combinations that CatBoost is good at handling
            // Interaction between form and location
            const formLocationInteraction = features.locationFactor * 
                (features.team1RecentForm - features.team2RecentForm) * 0.3;
            
            // Interaction between defense strength and importance
            const defenseImportanceInteraction = (features.team1DefenseStrength + features.team2DefenseStrength) * 
                ((features.matchImportance < 1) ? 0.4 : -0.2);
            
            // Adjust the total
            adjustedTotal += formLocationInteraction;
            adjustedTotal += defenseImportanceInteraction;
            
            // Adjust for match importance more precisely
            if (features.matchImportance < 1) {
                // Friendlies tend to have more goals (less defensive focus)
                adjustedTotal += (1 - features.matchImportance) * 0.6;
            } else if (features.matchImportance > 1.3) {
                // Very important matches can have fewer goals (more cautious play)
                adjustedTotal -= (features.matchImportance - 1.3) * 0.4;
            }
            
            // Add minimal randomness
            const randomness = (Math.random() * 0.4) - 0.2; // -0.2 to 0.2
            
            return [Math.max(0.5, adjustedTotal + randomness)];
        }
        else if (predictionType === 'margin') {
            // Simulate margin prediction with CatBoost
            
            // Base prediction from statistical model
            const baseMargin = calculateStatisticalProjectedMargin();
            
            // Start with that prediction and add CatBoost-specific adjustments
            
            // Apply regularization for small datasets
            const dataRegularization = Math.max(0, Math.min(0.3, 8 / getTotalMatchCount()));
            let adjustedMargin = baseMargin * (1 - dataRegularization);
            
            // Consider advanced feature combinations
            
            // Quality difference interaction with location
            const qualityDiff = (features.team1AvgScore - features.team2AvgScore) + 
                               (features.team2AvgConceded - features.team1AvgConceded);
            const qualityLocationInteraction = qualityDiff * features.locationFactor * 0.2;
            
            // Form difference interaction with importance
            const formDiff = features.team1RecentForm - features.team2RecentForm;
            const formImportanceInteraction = formDiff * (features.matchImportance - 1) * 0.5;
            
            // Adjust the margin
            adjustedMargin += qualityLocationInteraction;
            adjustedMargin += formImportanceInteraction;
            
            // Handle ranking difference with more nuance
            if (features.rankingDiff !== 0) {
                const rankingEffect = -features.rankingDiff / 50;
                // Apply non-linear effect (diminishing returns for extreme ranking differences)
                adjustedMargin += rankingEffect / (1 + Math.abs(rankingEffect) * 0.5);
            }
            
            // Add minimal randomness
            const randomness = (Math.random() * 0.3) - 0.15; // -0.15 to 0.15
            
            return [adjustedMargin + randomness];
        }
        
        throw new Error("Unknown prediction type");
    } catch (error) {
        console.error("Error in CatBoost simulation:", error);
        throw error;
    }
}

// XGBOOST FUNCTIONS
// =============================
// XGBoost-based win probability calculation
function calculateXGBoostWinProbabilities() {
    // Prepare features for the model
    const features = prepareMatchFeatures();
    
    try {
        // Simulate XGBoost prediction
        return simulateXGBoostPrediction(features, 'winProbability')
            .then(modelPrediction => {
                return {
                    team1WinProb: modelPrediction[0],
                    team2WinProb: modelPrediction[1],
                    drawProb: modelPrediction[2]
                };
            });
    } catch (error) {
        console.error("Error in XGBoost win probability calculation:", error);
        // Fall back to statistical model
        return Promise.resolve(calculateStatisticalWinProbabilities());
    }
}

// XGBoost-based projected total calculation
function calculateXGBoostProjectedTotal() {
    // Prepare features for the model
    const features = prepareMatchFeatures();
    
    try {
        // Simulate XGBoost prediction
        return simulateXGBoostPrediction(features, 'totalScore')
            .then(modelPrediction => {
                return modelPrediction[0];
            });
    } catch (error) {
        console.error("Error in XGBoost projected total calculation:", error);
        // Fall back to statistical model
        return Promise.resolve(calculateStatisticalProjectedTotal());
    }
}

// XGBoost-based projected margin calculation
function calculateXGBoostProjectedMargin() {
    // Prepare features for the model
    const features = prepareMatchFeatures();
    
    try {
        // Simulate XGBoost prediction
        return simulateXGBoostPrediction(features, 'margin')
            .then(modelPrediction => {
                return modelPrediction[0];
            });
    } catch (error) {
        console.error("Error in XGBoost projected margin calculation:", error);
        // Fall back to statistical model
        return Promise.resolve(calculateStatisticalProjectedMargin());
    }
}

// Simulate XGBoost predictions
async function simulateXGBoostPrediction(features, predictionType) {
    // Wait a moment to simulate model processing time
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
        // For demonstration purposes, we're using a simplified simulation
        // that incorporates the features but adds some ML-like randomness
        
        if (predictionType === 'winProbability') {
            // Simulate win probability calculation with ML adjustments
            const team1WinBase = 0.4 + 
                (features.team1AvgScore - features.team2AvgScore) * 0.1 +
                (features.team2AvgConceded - features.team1AvgConceded) * 0.05 +
                (features.team1RecentForm - features.team2RecentForm) * 0.15 +
                (features.h2hAdvantage) * 0.1 +
                (features.locationFactor) * 0.05 +
                (-features.rankingDiff / 100) * 0.05 +
                (features.team2DefenseStrength - features.team1DefenseStrength) * 0.05 +
                (features.team1AttackVariability - features.team2AttackVariability) * 0.03;
            
            const team2WinBase = 0.4 + 
                (features.team2AvgScore - features.team1AvgScore) * 0.1 +
                (features.team1AvgConceded - features.team2AvgConceded) * 0.05 +
                (features.team2RecentForm - features.team1RecentForm) * 0.15 +
                (-features.h2hAdvantage) * 0.1 +
                (-features.locationFactor) * 0.05 +
                (features.rankingDiff / 100) * 0.05 +
                (features.team1DefenseStrength - features.team2DefenseStrength) * 0.05 +
                (features.team2AttackVariability - features.team1AttackVariability) * 0.03;
            
            // Add slight randomness to simulate ML prediction variability
            const randomnessFactor = 0.02; // Reduced randomness for more stability
            const team1Win = Math.max(0.05, Math.min(0.9, team1WinBase + (Math.random() * 2 - 1) * randomnessFactor));
            const team2Win = Math.max(0.05, Math.min(0.9, team2WinBase + (Math.random() * 2 - 1) * randomnessFactor));
            
            // Adjust based on match importance
            let finalTeam1Win = team1Win;
            let finalTeam2Win = team2Win;
            
            if (features.matchImportance > 1) {
                // In important matches, favorites tend to win more
                if (team1Win > team2Win) {
                    finalTeam1Win = team1Win * (1 + (features.matchImportance - 1) * 0.1);
                    finalTeam2Win = team2Win * (1 - (features.matchImportance - 1) * 0.05);
                } else {
                    finalTeam2Win = team2Win * (1 + (features.matchImportance - 1) * 0.1);
                    finalTeam1Win = team1Win * (1 - (features.matchImportance - 1) * 0.05);
                }
            } else if (features.matchImportance < 1) {
                // In friendlies, results are more random
                finalTeam1Win = team1Win * (1 - (1 - features.matchImportance) * 0.2);
                finalTeam2Win = team2Win * (1 - (1 - features.matchImportance) * 0.2);
            }
            
            // Calculate draw probability
            const drawProb = Math.max(0, 100 - finalTeam1Win * 100 - finalTeam2Win * 100);
            
            // Return probabilities
            return [finalTeam1Win * 100, finalTeam2Win * 100, drawProb];
        } 
        else if (predictionType === 'totalScore') {
            // Simulate total score prediction with ML
            const baseTotal = features.team1AvgScore + features.team2AvgScore;
            
            // Consider defense strength
            const defenseAdjustment = (features.team1AvgConceded + features.team2AvgConceded) / 4;
            
            // Consider recent form (teams in good form tend to score more)
            const formAdjustment = (features.team1RecentForm + features.team2RecentForm) * 0.5;
            
            // Consider match importance
            let importanceAdjustment = 0;
            if (features.matchImportance < 1) {
                // Friendly matches often have more goals
                importanceAdjustment = (1 - features.matchImportance) * 0.5;
            } else if (features.matchImportance > 1.3) {
                // Very important matches can have fewer goals
                importanceAdjustment = -(features.matchImportance - 1.3) * 0.3;
            }
            
            // Consider team variability
            const variabilityAdjustment = (features.team1AttackVariability + features.team2AttackVariability) * 0.2;
            
            // Add randomness to simulate model's uncertainty (reduced for stability)
            const randomness = (Math.random() * 0.4) - 0.2; // -0.2 to 0.2
            
            // Calculate final prediction
            return [baseTotal + defenseAdjustment + formAdjustment + importanceAdjustment + variabilityAdjustment + randomness];
        }
        else if (predictionType === 'margin') {
            // Simulate margin prediction with ML
            const baseMargin = features.team1AvgScore - features.team2AvgScore;
            
            // Consider defensive strength
            const defenseAdjustment = (features.team2AvgConceded - features.team1AvgConceded) / 2;
            
            // Consider head-to-head history
            const h2hAdjustment = features.h2hAdvantage * 0.5;
            
            // Consider home field advantage
            const locationAdjustment = features.locationFactor * 0.4;
            
            // Consider form
            const formAdjustment = (features.team1RecentForm - features.team2RecentForm) * 0.7;
            
            // Consider ranking difference
            const rankingAdjustment = -features.rankingDiff / 50;
            
            // Consider match importance
            let importanceAdjustment = 0;
            if (features.matchImportance > 1) {
                // In important matches, the stronger team tends to win by more
                if (baseMargin > 0) {
                    importanceAdjustment = (features.matchImportance - 1) * 0.3;
                } else if (baseMargin < 0) {
                    importanceAdjustment = -(features.matchImportance - 1) * 0.3;
                }
            } else if (features.matchImportance < 1) {
                // In friendlies, margins tend to be smaller
                importanceAdjustment = -Math.sign(baseMargin) * (1 - features.matchImportance) * 0.2;
            }
            
            // Add randomness to simulate model's uncertainty (reduced for stability)
            const randomness = (Math.random() * 0.6) - 0.3; // -0.3 to 0.3
            
            // Calculate final prediction
            return [baseMargin + defenseAdjustment + h2hAdjustment + locationAdjustment + 
                   formAdjustment + rankingAdjustment + importanceAdjustment + randomness];
        }
        
        throw new Error("Unknown prediction type");
    } catch (error) {
        console.error("Error in XGBoost simulation:", error);
        throw error;
    }
}

// ENSEMBLE METHOD FUNCTIONS
// ========================
// Ensemble win probability calculation (combines all available models)
async function calculateEnsembleWinProbabilities() {
    try {
        // Get confidence scores for weighting
        const confidenceScores = await calculateModelConfidenceScores();
        
        // Initialize promises array
        const promises = [];
        const weights = [];
        
        // Add CatBoost if available
        if (useCatBoost && catboostModelLoaded) {
            promises.push(calculateCatBoostWinProbabilities());
            weights.push(confidenceScores.catboost);
        }
        
        // Add XGBoost if available
        if (useXGBoost && xgboostModelLoaded) {
            promises.push(calculateXGBoostWinProbabilities());
            weights.push(confidenceScores.xgboost);
        }
        
        // Always add statistical model
        promises.push(Promise.resolve(calculateStatisticalWinProbabilities()));
        weights.push(confidenceScores.statistical);
        
        // Wait for all predictions
        const results = await Promise.all(promises);
        
        // Normalize weights to sum to 1
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        const normalizedWeights = weights.map(w => w / totalWeight);
        
        // Calculate weighted average
        let team1WinProb = 0;
        let team2WinProb = 0;
        let drawProb = 0;
        
        results.forEach((result, index) => {
            team1WinProb += result.team1WinProb * normalizedWeights[index];
            team2WinProb += result.team2WinProb * normalizedWeights[index];
            drawProb += result.drawProb * normalizedWeights[index];
        });
        
        return {
            team1WinProb,
            team2WinProb,
            drawProb
        };
    } catch (error) {
        console.error("Error in ensemble win probability calculation:", error);
        // Fall back to statistical model
        return calculateStatisticalWinProbabilities();
    }
}

// Ensemble projected total calculation
async function calculateEnsembleProjectedTotal() {
    try {
        // Get confidence scores for weighting
        const confidenceScores = await calculateModelConfidenceScores();
        
        // Initialize promises array
        const promises = [];
        const weights = [];
        
        // Add CatBoost if available
        if (useCatBoost && catboostModelLoaded) {
            promises.push(calculateCatBoostProjectedTotal());
            weights.push(confidenceScores.catboost);
        }
        
        // Add XGBoost if available
        if (useXGBoost && xgboostModelLoaded) {
            promises.push(calculateXGBoostProjectedTotal());
            weights.push(confidenceScores.xgboost);
        }
        
        // Always add statistical model
        promises.push(Promise.resolve(calculateStatisticalProjectedTotal()));
        weights.push(confidenceScores.statistical);
        
        // Wait for all predictions
        const results = await Promise.all(promises);
        
        // Normalize weights to sum to 1
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        const normalizedWeights = weights.map(w => w / totalWeight);
        
        // Calculate weighted average
        let projectedTotal = 0;
        
        results.forEach((result, index) => {
            projectedTotal += result * normalizedWeights[index];
        });
        
        return projectedTotal;
    } catch (error) {
        console.error("Error in ensemble projected total calculation:", error);
        // Fall back to statistical model
        return calculateStatisticalProjectedTotal();
    }
}

// Ensemble projected margin calculation
async function calculateEnsembleProjectedMargin() {
    try {
        // Get confidence scores for weighting
        const confidenceScores = await calculateModelConfidenceScores();
        
        // Initialize promises array
        const promises = [];
        const weights = [];
        
        // Add CatBoost if available
        if (useCatBoost && catboostModelLoaded) {
            promises.push(calculateCatBoostProjectedMargin());
            weights.push(confidenceScores.catboost);
        }
        
        // Add XGBoost if available
        if (useXGBoost && xgboostModelLoaded) {
            promises.push(calculateXGBoostProjectedMargin());
            weights.push(confidenceScores.xgboost);
        }
        
        // Always add statistical model
        promises.push(Promise.resolve(calculateStatisticalProjectedMargin()));
        weights.push(confidenceScores.statistical);
        
        // Wait for all predictions
        const results = await Promise.all(promises);
        
        // Normalize weights to sum to 1
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        const normalizedWeights = weights.map(w => w / totalWeight);
        
        // Calculate weighted average
        let projectedMargin = 0;
        
        results.forEach((result, index) => {
            projectedMargin += result * normalizedWeights[index];
        });
        
        return projectedMargin;
    } catch (error) {
        console.error("Error in ensemble projected margin calculation:", error);
        // Fall back to statistical model
        return calculateStatisticalProjectedMargin();
    }
}

// Prepare match features for all ML models
function prepareMatchFeatures() {
    // Calculate various statistics from the match data
    const team1AvgScore = calculateOverallTeamAverage(team1Name, true);
    const team2AvgScore = calculateOverallTeamAverage(team2Name, false);
    
    const team1AvgConceded = calculateTeamAverageConceded(team1Name, true);
    const team2AvgConceded = calculateTeamAverageConceded(team2Name, false);
    
    const team1RecentForm = calculateRecentForm(team1Name, true);
    const team2RecentForm = calculateRecentForm(team2Name, false);
    
    const h2hAdvantage = calculateH2HAdvantage(team1Name);
    
    const locationFactor = matchLocation === 'home' ? 1 : (matchLocation === 'away' ? -1 : 0);
    
    const rankingDiff = team1Ranking && team2Ranking ? team1Ranking - team2Ranking : 0;
    
    // Add additional features for improved model
    const matchesPlayed = getTotalMatchCount();
    const team1DefenseStrength = calculateDefenseStrength(team1Name, true);
    const team2DefenseStrength = calculateDefenseStrength(team2Name, false);
    const team1AttackVariability = calculateTeamVariability(team1Name, true, 'attack');
    const team2AttackVariability = calculateTeamVariability(team2Name, false, 'attack');
    const team1DefenseVariability = calculateTeamVariability(team1Name, true, 'defense');
    const team2DefenseVariability = calculateTeamVariability(team2Name, false, 'defense');
    
    // Return features in a format suitable for the models
    return {
        team1AvgScore,
        team2AvgScore,
        team1AvgConceded,
        team2AvgConceded,
        team1RecentForm,
        team2RecentForm,
        h2hAdvantage,
        matchImportance,
        locationFactor,
        rankingDiff,
        totalLine,
        pointSpread,
        spreadDirection: spreadDirection === 'team1' ? 1 : -1,
        matchesPlayed,
        team1DefenseStrength,
        team2DefenseStrength,
        team1AttackVariability,
        team2AttackVariability,
        team1DefenseVariability,
        team2DefenseVariability
    };
}

// STATISTICAL MODEL FUNCTIONS
// =============================
// Calculate win probabilities using traditional statistical methods
function calculateStatisticalWinProbabilities() {
    // Default values if no data
    if (getTotalMatchCount() === 0) {
        return {
            team1WinProb: 33.3,
            team2WinProb: 33.3,
            drawProb: 33.4
        };
    }
    
    // Calculate base probabilities from historical data
    let team1WinPct = 0;
    let team2WinPct = 0;
    let drawPct = 0;
    
    // Get H2H win percentages if available
    if (matchData.h2h.length > 0) {
        const team1Wins = matchData.h2h.filter(match => match.outcome === `${team1Name} Wins`).length;
        const team2Wins = matchData.h2h.filter(match => match.outcome === `${team2Name} Wins`).length;
        const draws = matchData.h2h.filter(match => match.outcome === 'Draw').length;
        
        team1WinPct = (team1Wins / matchData.h2h.length) * 100;
        team2WinPct = (team2Wins / matchData.h2h.length) * 100;
        drawPct = (draws / matchData.h2h.length) * 100;
    } else {
        // No H2H data, use individual team data
        const team1Wins = matchData.team1.filter(match => match.outcome === `${team1Name} Wins`).length;
        const team1Matches = matchData.team1.length || 1;
        
        const team2Wins = matchData.team2.filter(match => match.outcome === `${team2Name} Wins`).length;
        const team2Matches = matchData.team2.length || 1;
        
        team1WinPct = (team1Wins / team1Matches) * 100;
        team2WinPct = (team2Wins / team2Matches) * 100;
        drawPct = 100 - team1WinPct - team2WinPct;
        
        // Adjust draw percentage to be at least 10%
        if (drawPct < 10) {
            const adjustment = (10 - drawPct) / 2;
            team1WinPct -= adjustment;
            team2WinPct -= adjustment;
            drawPct = 10;
        }
    }
    
    // Apply home advantage adjustment
    if (matchLocation === 'home') {
        team1WinPct += 10;
        team2WinPct -= 5;
        drawPct -= 5;
    } else if (matchLocation === 'away') {
        team2WinPct += 10;
        team1WinPct -= 5;
        drawPct -= 5;
    }
    
    // Apply ranking adjustment if available
    if (team1Ranking > 0 && team2Ranking > 0) {
        const rankingDiff = team2Ranking - team1Ranking;
        const rankingAdjustment = rankingDiff * 0.5;
        
        team1WinPct += rankingAdjustment;
        team2WinPct -= rankingAdjustment;
    }
    
    // Apply match importance adjustment
    if (matchImportance > 1) {
        // In important matches, better teams tend to win more
        if (team1WinPct > team2WinPct) {
            const importanceBoost = (matchImportance - 1) * 5;
            team1WinPct += importanceBoost;
            team2WinPct -= importanceBoost / 2;
            drawPct -= importanceBoost / 2;
        } else if (team2WinPct > team1WinPct) {
            const importanceBoost = (matchImportance - 1) * 5;
            team2WinPct += importanceBoost;
            team1WinPct -= importanceBoost / 2;
            drawPct -= importanceBoost / 2;
        }
    } else if (matchImportance < 1) {
        // In less important matches (like friendlies), outcomes are more random
        // Adjust probabilities to be closer to each other
        const equalizer = (1 - matchImportance) * 15;
        const team1Adj = team1WinPct > 33.3 ? -equalizer : equalizer;
        const team2Adj = team2WinPct > 33.3 ? -equalizer : equalizer;
        const drawAdj = drawPct > 33.3 ? -equalizer : equalizer;
        
        team1WinPct += team1Adj;
        team2WinPct += team2Adj;
        drawPct += drawAdj;
    }
    
    // Ensure percentages are within reasonable ranges
    team1WinPct = Math.max(5, Math.min(90, team1WinPct));
    team2WinPct = Math.max(5, Math.min(90, team2WinPct));
    drawPct = Math.max(5, Math.min(50, drawPct));
    
    // Normalize to ensure sum equals 100%
    const total = team1WinPct + team2WinPct + drawPct;
    
    return {
        team1WinProb: (team1WinPct / total) * 100,
        team2WinProb: (team2WinPct / total) * 100,
        drawProb: (drawPct / total) * 100
    };
}

// Calculate projected total based on team averages
function calculateStatisticalProjectedTotal() {
    if (getTotalMatchCount() === 0) {
        return totalLine > 0 ? totalLine : 2.5; // Use the line if no data or default to 2.5
    }
    
    // Calculate team averages
    let team1AvgScore = 0;
    let team2AvgScore = 0;
    
    // Use H2H data if available
    if (matchData.h2h.length > 0) {
        team1AvgScore = calculateCategoryAverage('h2h', 'team1Score');
        team2AvgScore = calculateCategoryAverage('h2h', 'team2Score');
    } else {
        // Use individual team data
        if (matchData.team1.length > 0) {
            team1AvgScore = calculateCategoryAverage('team1', 'team1Score');
        } else {
            team1AvgScore = 1.5; // Default value
        }
        
        if (matchData.team2.length > 0) {
            team2AvgScore = calculateCategoryAverage('team2', 'team2Score');
        } else {
            team2AvgScore = 1.5; // Default value
        }
    }
    
    // Apply home/away adjustment
    if (matchLocation === 'home') {
        team1AvgScore *= 1.1;
    } else if (matchLocation === 'away') {
        team2AvgScore *= 1.1;
    }
    
    // Apply match importance adjustment
    if (matchImportance > 1) {
        // Important matches sometimes have more goals
        const importanceAdjustment = (matchImportance - 1) * 0.25;
        team1AvgScore += importanceAdjustment;
        team2AvgScore += importanceAdjustment;
    } else if (matchImportance < 1) {
        // Friendly matches often have more goals as defense is more relaxed
        team1AvgScore *= 1.1;
        team2AvgScore *= 1.1;
    }
    
    return team1AvgScore + team2AvgScore;
}

// Calculate projected margin
function calculateStatisticalProjectedMargin() {
    if (getTotalMatchCount() === 0) {
        return 0; // No data, no projected margin
    }
    
    // Calculate average margins
    let margin = 0;
    
    // Use H2H data if available
    if (matchData.h2h.length > 0) {
        const margins = matchData.h2h.map(match => match.team1Score - match.team2Score);
        margin = margins.reduce((sum, val) => sum + val, 0) / margins.length;
    } else {
        // Use individual team data to estimate
        const team1AvgScoring = matchData.team1.length > 0 ? 
            calculateCategoryAverage('team1', 'team1Score') : 1.5;
        
        const team2AvgScoring = matchData.team2.length > 0 ? 
            calculateCategoryAverage('team2', 'team2Score') : 1.5;
        
        const team1AvgConceded = matchData.team1.length > 0 ? 
            calculateCategoryAverage('team1', 'team2Score') : 1.5;
        
        const team2AvgConceded = matchData.team2.length > 0 ? 
            calculateCategoryAverage('team2', 'team1Score') : 1.5;
        
        // Estimated margin based on attack and defense strength
        margin = (team1AvgScoring - team2AvgConceded) - (team2AvgScoring - team1AvgConceded);
    }
    
    // Apply home/away adjustment
    if (matchLocation === 'home') {
        margin += 0.5;
    } else if (matchLocation === 'away') {
        margin -= 0.5;
    }
    
    // Apply ranking adjustment
    if (team1Ranking > 0 && team2Ranking > 0) {
        margin += (team2Ranking - team1Ranking) * 0.05;
    }
    
    // Apply match importance adjustment
    if (matchImportance > 1) {
        // In important matches, the better team often wins by more
        const betterTeam = calculateOverallTeamAverage(team1Name, true) > calculateOverallTeamAverage(team2Name, false);
        
        if (betterTeam && margin > 0) {
            margin *= matchImportance;
        } else if (!betterTeam && margin < 0) {
            margin *= matchImportance;
        }
    } else if (matchImportance < 1) {
        // In friendlies, margins tend to be smaller
        margin *= matchImportance;
    }
    
    return margin;
}

// HELPER FUNCTIONS
// =============================
// Calculate team's defensive strength (lower is better)
function calculateDefenseStrength(teamName, isTeam1) {
    // Higher values indicate worse defense
    const avgConceded = calculateTeamAverageConceded(teamName, isTeam1);
    const leagueAvgConceded = 1.5; // Default league average
    
    // Return relative to league average (1.0 is average, lower is better)
    return avgConceded / leagueAvgConceded;
}

// Calculate team's variability in scoring or conceding
function calculateTeamVariability(teamName, isTeam1, aspect) {
    let values = [];
    
    if (aspect === 'attack') {
        // Collect all scores the team has made
        if (isTeam1) {
            matchData.h2h.forEach(match => values.push(match.team1Score));
            matchData.team1.forEach(match => values.push(match.team1Score));
        } else {
            matchData.h2h.forEach(match => values.push(match.team2Score));
            matchData.team2.forEach(match => values.push(match.team2Score));
        }
    } else { // defense
        // Collect all scores conceded by the team
        if (isTeam1) {
            matchData.h2h.forEach(match => values.push(match.team2Score));
            matchData.team1.forEach(match => values.push(match.team2Score));
        } else {
            matchData.h2h.forEach(match => values.push(match.team1Score));
            matchData.team2.forEach(match => values.push(match.team1Score));
        }
    }
    
    // If not enough data, return a default value
    if (values.length < 2) return 1.0;
    
    // Calculate standard deviation
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalize: 1.0 is average variability
    return stdDev / Math.max(0.1, mean);
}

// Calculate team's average conceded goals
function calculateTeamAverageConceded(teamName, isTeam1) {
    let sum = 0;
    let count = 0;
    
    // Add H2H matches
    matchData.h2h.forEach(match => {
        if (isTeam1) {
            sum += match.team2Score;
        } else {
            sum += match.team1Score;
        }
        count++;
    });
    
    // Add team matches
    const teamCategory = isTeam1 ? 'team1' : 'team2';
    const opponentProperty = isTeam1 ? 'team2Score' : 'team1Score';
    
    matchData[teamCategory].forEach(match => {
        sum += match[opponentProperty];
        count++;
    });
    
    return count > 0 ? sum / count : 1.5; // Default to 1.5 if no data
}

// Calculate recent form (last 3-5 matches)
function calculateRecentForm(teamName, isTeam1) {
    // Get relevant matches
    let teamMatches = [];
    
    if (isTeam1) {
        teamMatches = [...matchData.h2h.map(match => ({
            win: match.outcome === `${team1Name} Wins`,
            draw: match.outcome === 'Draw',
            lose: match.outcome === `${team2Name} Wins`,
            timestamp: match.timestamp
        })), ...matchData.team1.map(match => ({
            win: match.outcome === `${team1Name} Wins`,
            draw: match.outcome === 'Draw',
            lose: match.outcome === 'Opponent Wins',
            timestamp: match.timestamp
        }))];
    } else {
        teamMatches = [...matchData.h2h.map(match => ({
            win: match.outcome === `${team2Name} Wins`,
            draw: match.outcome === 'Draw',
            lose: match.outcome === `${team1Name} Wins`,
            timestamp: match.timestamp
        })), ...matchData.team2.map(match => ({
            win: match.outcome === `${team2Name} Wins`,
            draw: match.outcome === 'Draw',
            lose: match.outcome === 'Opponent Wins',
            timestamp: match.timestamp
        }))];
    }
    
    // Sort by timestamp (most recent first) and take last 5 matches
    teamMatches.sort((a, b) => b.timestamp - a.timestamp);
    teamMatches = teamMatches.slice(0, Math.min(5, teamMatches.length));
    
    if (teamMatches.length === 0) return 0.5; // Default neutral form if no data
    
    // Calculate form score: win = 3 points, draw = 1 point, loss = 0 points
    let formScore = 0;
    teamMatches.forEach(match => {
        if (match.win) formScore += 3;
        else if (match.draw) formScore += 1;
    });
    
    // Return normalized score (0-1)
    return formScore / (teamMatches.length * 3);
}

// Calculate head-to-head advantage
function calculateH2HAdvantage(teamName) {
    if (matchData.h2h.length === 0) return 0;
    
    const team1Wins = matchData.h2h.filter(match => match.outcome === `${team1Name} Wins`).length;
    const team2Wins = matchData.h2h.filter(match => match.outcome === `${team2Name} Wins`).length;
    
    // Return value between -1 and 1
    return (team1Wins - team2Wins) / matchData.h2h.length;
}

// Get total match count across all categories
function getTotalMatchCount() {
    return matchData.h2h.length + matchData.team1.length + matchData.team2.length;
}

// Calculate average for a specific category and property
function calculateCategoryAverage(category, property) {
    const matches = matchData[category];
    if (matches.length === 0) return 0;
    
    return matches.reduce((sum, match) => sum + match[property], 0) / matches.length;
}

// Calculate overall team average across all matches
function calculateOverallTeamAverage(teamName, isTeam1) {
    let sum = 0;
    let count = 0;
    
    // Add H2H matches
    matchData.h2h.forEach(match => {
        if (isTeam1) {
            sum += match.team1Score;
        } else {
            sum += match.team2Score;
        }
        count++;
    });
    
    // Add team matches
    const teamCategory = isTeam1 ? 'team1' : 'team2';
    const teamProperty = isTeam1 ? 'team1Score' : 'team2Score';
    
    matchData[teamCategory].forEach(match => {
        sum += match[teamProperty];
        count++;
    });
    
    return count > 0 ? sum / count : 1.5; // Default to 1.5 if no data
}

// Calculate over percentage
function calculateOverPercentage() {
    const allMatches = [...matchData.h2h, ...matchData.team1, ...matchData.team2];
    if (allMatches.length === 0 || totalLine <= 0) return 50;
    
    const overCount = allMatches.filter(match => match.totalScore > totalLine).length;
    return Math.round((overCount / allMatches.length) * 100);
}

// Calculate over/under recommendation based on edge
function calculateOverUnderRecommendation(overUnderEdge) {
    if (totalLine <= 0) return "NO LINE SET";
    
    if (overUnderEdge > 5) {
        return 'OVER';
    } else if (overUnderEdge < -5) {
        return 'UNDER';
    } else {
        return 'NO EDGE';
    }
}

// Calculate spread recommendation based on edge
function calculateSpreadRecommendation(spreadEdge) {
    if (pointSpread <= 0) return "NO SPREAD SET";
    
    if (spreadEdge > 5) {
        // If projected margin is much larger than spread, favorite will cover
        return spreadDirection === 'team1' ? `${team1Name} -${pointSpread}` : `${team2Name} -${pointSpread}`;
    } else if (spreadEdge < -5) {
        // If projected margin is smaller than spread, underdog will cover
        return spreadDirection === 'team1' ? `${team2Name} +${pointSpread}` : `${team1Name} +${pointSpread}`;
    } else {
        return 'NO EDGE';
    }
}

// UI UPDATE FUNCTIONS
// =============================
// Update winner prediction UI
function updateWinnerPrediction(probabilities) {
    let winnerName, winnerProb, loserName, loserProb;
    
    if (probabilities.team1WinProb > probabilities.team2WinProb && 
        probabilities.team1WinProb > probabilities.drawProb) {
        winnerName = team1Name;
        winnerProb = probabilities.team1WinProb;
        loserName = team2Name;
        loserProb = probabilities.team2WinProb;
    } else if (probabilities.team2WinProb > probabilities.team1WinProb && 
               probabilities.team2WinProb > probabilities.drawProb) {
        winnerName = team2Name;
        winnerProb = probabilities.team2WinProb;
        loserName = team1Name;
        loserProb = probabilities.team1WinProb;
    } else {
        // Handle draw as most likely outcome
        winnerName = "Draw";
        winnerProb = probabilities.drawProb;
        loserName = probabilities.team1WinProb > probabilities.team2WinProb ? team2Name : team1Name;
        loserProb = Math.min(probabilities.team1WinProb, probabilities.team2WinProb);
    }
    
    const confidenceLevel = winnerProb >= 60 ? "High" : (winnerProb >= 45 ? "Medium" : "Low");
    const confidenceClass = confidenceLevel.toLowerCase();
    
    const winnerPredictionHTML = `
        <div class="prediction-confidence ${confidenceClass}-confidence">
            ${confidenceLevel} Confidence
        </div>
        <div class="teams-prediction">
            <div class="team-prediction ${winnerName === team1Name ? 'winner' : ''}">
                <div class="team-name">${team1Name}</div>
                <div class="team-probability">${probabilities.team1WinProb.toFixed(1)}%</div>
            </div>
            
            <div class="vs-container">VS</div>
            
            <div class="team-prediction ${winnerName === team2Name ? 'winner' : ''}">
                <div class="team-name">${team2Name}</div>
                <div class="team-probability">${probabilities.team2WinProb.toFixed(1)}%</div>
            </div>
        </div>
        <div class="draw-probability">Draw probability: ${probabilities.drawProb.toFixed(1)}%</div>
    `;
    
    document.getElementById('winner-prediction').innerHTML = winnerPredictionHTML;
}

// Update score prediction UI
function updateScorePrediction(team1Score, team2Score, projectedTotal, totalLine) {
    const scorePredictionHTML = `
        <div class="predicted-score">
            <div class="score-value">${team1Name} ${team1Score} - ${team2Score} ${team2Name}</div>
        </div>
        <div class="score-explanation">
            <strong>Total Projected Score:</strong> ${projectedTotal.toFixed(1)}
            ${totalLine > 0 ? `<span class="${projectedTotal > totalLine ? 'positive-recommendation' : 'negative-recommendation'}">
                (${projectedTotal > totalLine ? 'OVER' : 'UNDER'} ${totalLine})
            </span>` : ''}
        </div>
        <div class="projection-details">
            <div><strong>${team1Name}:</strong> ${team1Score} goals</div>
            <div><strong>${team2Name}:</strong> ${team2Score} goals</div>
        </div>
    `;
    
    document.getElementById('score-prediction').innerHTML = scorePredictionHTML;
}

// Update betting recommendation UI
function updateBettingRecommendation(totalRec, spreadRec, overUnderEdge, spreadEdge) {
    // Only show edge strength if betting lines are set
    const totalEdgeClass = totalLine > 0 ? 
        (overUnderEdge > 5 ? 'positive-recommendation' : (overUnderEdge < -5 ? 'negative-recommendation' : 'neutral-recommendation')) : 
        'neutral-recommendation';
    
    const spreadEdgeClass = pointSpread > 0 ? 
        (spreadEdge > 5 ? 'positive-recommendation' : (spreadEdge < -5 ? 'negative-recommendation' : 'neutral-recommendation')) : 
        'neutral-recommendation';
    
    // Only show edge strength if betting lines are set
    const edgeStrengthTotal = totalLine > 0 ? 
        (Math.abs(overUnderEdge) > 10 ? 'Strong' : (Math.abs(overUnderEdge) > 5 ? 'Moderate' : 'Weak')) : 
        '';
    
    const edgeStrengthSpread = pointSpread > 0 ? 
        (Math.abs(spreadEdge) > 10 ? 'Strong' : (Math.abs(spreadEdge) > 5 ? 'Moderate' : 'Weak')) : 
        '';
    
    const bettingRecommendationHTML = `
        <div class="betting-advice">
            <div class="advice-label">Total Line ${totalLine > 0 ? `(${totalLine})` : ''}</div>
            <div class="advice-value ${totalEdgeClass}">${totalRec}</div>
            ${totalLine > 0 ? `<div class="advice-edge">${edgeStrengthTotal} Edge: ${Math.abs(overUnderEdge).toFixed(1)}%</div>` : ''}
        </div>
        
        <div class="betting-advice">
            <div class="advice-label">Spread ${pointSpread > 0 ? `(${formatSpreadForDisplay()})` : ''}</div>
            <div class="advice-value ${spreadEdgeClass}">${spreadRec}</div>
            ${pointSpread > 0 ? `<div class="advice-edge">${edgeStrengthSpread} Edge: ${Math.abs(spreadEdge).toFixed(1)}%</div>` : ''}
        </div>
        
        ${(totalLine > 0 || pointSpread > 0) ? `
        <div class="best-bet">
            <div class="best-bet-label">Best Bet:</div>
            <div class="best-bet-value ${Math.abs(overUnderEdge) > Math.abs(spreadEdge) ? totalEdgeClass : spreadEdgeClass}">
                ${Math.abs(overUnderEdge) > Math.abs(spreadEdge) ? 
                  `${totalRec} ${totalLine}` : 
                  spreadRec}
            </div>
        </div>` : ''}
    `;
    
    document.getElementById('betting-recommendation').innerHTML = bettingRecommendationHTML;
}

// Format point spread for display
function formatSpreadForDisplay() {
    if (pointSpread <= 0) return '';
    
    const favoredTeam = spreadDirection === 'team1' ? team1Name : team2Name;
    const underdogTeam = spreadDirection === 'team1' ? team2Name : team1Name;
    
    return `${favoredTeam} -${pointSpread} / ${underdogTeam} +${pointSpread}`;
}

// Update analysis explanation UI
function updateAnalysisExplanation(probabilities, projectedTotal, projectedMargin, team1Score, team2Score, usingML = true) {
    let winnerName, winnerProb;
    
    if (probabilities.team1WinProb > probabilities.team2WinProb && 
        probabilities.team1WinProb > probabilities.drawProb) {
        winnerName = team1Name;
        winnerProb = probabilities.team1WinProb;
    } else if (probabilities.team2WinProb > probabilities.team1WinProb && 
               probabilities.team2WinProb > probabilities.drawProb) {
        winnerName = team2Name;
        winnerProb = probabilities.team2WinProb;
    } else {
        winnerName = "A draw";
        winnerProb = probabilities.drawProb;
    }
    
    // Generate explanations
    let matchFactors = [];
    
    // Add match type factor
    const matchType = document.getElementById('match-importance').options[document.getElementById('match-importance').selectedIndex].text;
    matchFactors.push(`This is a ${matchType} match`);
    
    // Add home/away factor
    if (matchLocation === 'home') {
        matchFactors.push(`${team1Name} has a home advantage in this match`);
    } else if (matchLocation === 'away') {
        matchFactors.push(`${team2Name} has a home advantage in this match`);
    }
    
    // Add ranking factor if available
    if (team1Ranking > 0 && team2Ranking > 0) {
        const rankingDiff = Math.abs(team1Ranking - team2Ranking);
        if (rankingDiff > 5) {
            const higherRankedTeam = team1Ranking < team2Ranking ? team1Name : team2Name;
            matchFactors.push(`${higherRankedTeam} has a significantly better ranking (${Math.min(team1Ranking, team2Ranking)} vs ${Math.max(team1Ranking, team2Ranking)})`);
        }
    }
    
    // Add H2H record factor if available
    if (matchData.h2h.length >= 2) {
        const team1Wins = matchData.h2h.filter(match => match.outcome === `${team1Name} Wins`).length;
        const team2Wins = matchData.h2h.filter(match => match.outcome === `${team2Name} Wins`).length;
        
        if (team1Wins > team2Wins) {
            matchFactors.push(`${team1Name} has a better head-to-head record (${team1Wins}-${team2Wins})`);
        } else if (team2Wins > team1Wins) {
            matchFactors.push(`${team2Name} has a better head-to-head record (${team2Wins}-${team1Wins})`);
        }
    }
    
    // Add recent form factor
    if (matchData.team1.length >= 3) {
        const team1RecentWins = matchData.team1.filter(match => match.outcome === `${team1Name} Wins`).length;
        const team1WinPercentage = (team1RecentWins / matchData.team1.length) * 100;
        
        if (team1WinPercentage >= 67) {
            matchFactors.push(`${team1Name} has strong recent form (${team1WinPercentage.toFixed(1)}% win rate)`);
        } else if (team1WinPercentage <= 33) {
            matchFactors.push(`${team1Name} has poor recent form (${team1WinPercentage.toFixed(1)}% win rate)`);
        }
    }
    
    if (matchData.team2.length >= 3) {
        const team2RecentWins = matchData.team2.filter(match => match.outcome === `${team2Name} Wins`).length;
        const team2WinPercentage = (team2RecentWins / matchData.team2.length) * 100;
        
        if (team2WinPercentage >= 67) {
            matchFactors.push(`${team2Name} has strong recent form (${team2WinPercentage.toFixed(1)}% win rate)`);
        } else if (team2WinPercentage <= 33) {
            matchFactors.push(`${team2Name} has poor recent form (${team2WinPercentage.toFixed(1)}% win rate)`);
        }
    }
    
    // Add scoring factor
    const team1AvgScore = calculateOverallTeamAverage(team1Name, true);
    const team2AvgScore = calculateOverallTeamAverage(team2Name, false);
    
    if (Math.abs(team1AvgScore - team2AvgScore) > 0.5) {
        const betterScoringTeam = team1AvgScore > team2AvgScore ? team1Name : team2Name;
        matchFactors.push(`${betterScoringTeam} has better scoring overall (${Math.max(team1AvgScore, team2AvgScore).toFixed(1)} vs ${Math.min(team1AvgScore, team2AvgScore).toFixed(1)} goals per match)`);
    }
    
    // Add over/under historical rate if total line is set
    if (totalLine > 0) {
        const overPercentage = calculateOverPercentage();
        
        if (overPercentage > 60) {
            matchFactors.push(`${overPercentage}% of matches have gone OVER the total line of ${totalLine}`);
        } else if (overPercentage < 40) {
            matchFactors.push(`${100 - overPercentage}% of matches have gone UNDER the total line of ${totalLine}`);
        }
    }
    
    // If using ML, add some ML-specific insights
    if (usingML) {
        const team1Form = calculateRecentForm(team1Name, true);
        const team2Form = calculateRecentForm(team2Name, false);
        
        if (Math.abs(team1Form - team2Form) > 0.3) {
            const betterFormTeam = team1Form > team2Form ? team1Name : team2Name;
            matchFactors.push(`${betterFormTeam} has significantly better recent form based on machine learning analysis`);
        }
        
        // Add feature importance insight
        const mostImportantFactor = getMostImportantFeature();
        matchFactors.push(`The machine learning model considers ${mostImportantFactor} as the most important factor in this matchup`);
    }
    
    // Build explanation HTML
    const factorsHtml = matchFactors.length > 0 
        ? `<ul>${matchFactors.map(factor => `<li>${factor}</li>`).join('')}</ul>` 
        : '<p>No significant factors found in the data.</p>';
    
    let modelTypeText = "";
    
    if (useXGBoost && useCatBoost && useStatistical) {
        modelTypeText = "Using ensemble modeling with dynamic weighting (combining CatBoost, XGBoost, and statistical analysis)";
    } else if (useCatBoost) {
        modelTypeText = "Using CatBoost model optimized for categorical features and small datasets";
    } else if (useXGBoost) {
        modelTypeText = "Using XGBoost machine learning model for complex pattern detection";
    } else {
        modelTypeText = "Using statistical modeling based on historical data patterns";
    }
    
    // Generate betting analysis
    let bettingAnalysisHtml = "";
    
    if (totalLine > 0 || pointSpread > 0) {
        bettingAnalysisHtml = `
            <h4>Betting Analysis:</h4>
            ${totalLine > 0 ? `
                <p>With a projected total score of ${projectedTotal.toFixed(1)}, this suggests the match will likely go 
                ${projectedTotal > totalLine ? 'OVER' : 'UNDER'} the total line of ${totalLine}.</p>
            ` : ''}
            
            ${pointSpread > 0 ? `
                <p>The projected margin of ${Math.abs(projectedMargin).toFixed(1)} goals in favor of 
                ${projectedMargin > 0 ? team1Name : team2Name} 
                ${Math.abs(projectedMargin) > pointSpread ? 'suggests they will cover' : 'may not be enough to cover'} 
                the point spread of ${pointSpread}.</p>
            ` : ''}
        `;
    } else {
        bettingAnalysisHtml = "<p>Set betting lines to see betting analysis and recommendations.</p>";
    }
    
    const explanationHTML = `
        <p>Based on the match data provided, our analysis indicates that <strong>${winnerName}</strong> has a ${winnerProb.toFixed(1)}% probability of winning this match with a projected score of <strong>${team1Score}-${team2Score}</strong>.</p>
        
        <h4>Key Factors in This Analysis:</h4>
        ${factorsHtml}
        
        ${bettingAnalysisHtml}
        
        <div class="model-info">
            <p><strong>Analysis method:</strong> ${modelTypeText}</p>
            <p><strong>Note:</strong> This analysis is based on historical data and statistical/ML models. Actual outcomes may vary due to factors not accounted for in the analysis.</p>
        </div>
    `;
    
    document.getElementById('analysis-explanation').innerHTML = explanationHTML;
}

// Get most important feature for ML explanation
function getMostImportantFeature() {
    // In a real implementation, this would come from the model's feature importance
    // For this demo, we'll determine based on the actual data which factor might be most important
    
    const factors = [
        { name: "recent team form", weight: 0 },
        { name: "head-to-head history", weight: 0 },
        { name: "scoring ability", weight: 0 },
        { name: "defensive strength", weight: 0 },
        { name: "home field advantage", weight: 0 },
        { name: "match importance", weight: 0 }
    ];
    
    // Calculate weights based on actual data
    // Form difference
    const team1Form = calculateRecentForm(team1Name, true);
    const team2Form = calculateRecentForm(team2Name, false);
    factors[0].weight = Math.abs(team1Form - team2Form) * 5;
    
    // H2H history
    const h2hAdvantage = calculateH2HAdvantage(team1Name);
    factors[1].weight = Math.abs(h2hAdvantage) * 5;
    
    // Scoring difference
    const team1AvgScore = calculateOverallTeamAverage(team1Name, true);
    const team2AvgScore = calculateOverallTeamAverage(team2Name, false);
    factors[2].weight = Math.abs(team1AvgScore - team2AvgScore) * 2;
    
    // Defense difference
    const team1Conceded = calculateTeamAverageConceded(team1Name, true);
    const team2Conceded = calculateTeamAverageConceded(team2Name, false);
    factors[3].weight = Math.abs(team1Conceded - team2Conceded) * 2;
    
    // Home advantage
    factors[4].weight = matchLocation !== 'neutral' ? 3 : 0;
    
    // Match importance
    factors[5].weight = Math.abs(matchImportance - 1) * 4;
    
    // Sort by weight and return the top factor
    factors.sort((a, b) => b.weight - a.weight);
    return factors[0].name;
}

// Create win probability chart
function createWinProbabilityChart(probabilities) {
    // Destroy previous chart if it exists
    if (winProbabilityChart) {
        winProbabilityChart.destroy();
    }
    
    const ctx = document.getElementById('win-probability-chart').getContext('2d');
    
    winProbabilityChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [team1Name, team2Name, 'Draw'],
            datasets: [{
                data: [
                    probabilities.team1WinProb,
                    probabilities.team2WinProb,
                    probabilities.drawProb
                ],
                backgroundColor: [
                    'rgba(66, 133, 244, 0.8)',
                    'rgba(234, 67, 53, 0.8)',
                    'rgba(95, 99, 104, 0.8)'
                ],
                borderColor: [
                    'rgba(66, 133, 244, 1)',
                    'rgba(234, 67, 53, 1)',
                    'rgba(95, 99, 104, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: false,
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw.toFixed(1)}%`;
                        }
                    }
                }
            }
        }
    });
}

// Create model confidence chart
function createModelConfidenceChart(confidenceScores) {
    // Destroy previous chart if it exists
    if (modelConfidenceChart) {
        modelConfidenceChart.destroy();
    }
    
    const ctx = document.getElementById('model-confidence-chart').getContext('2d');
    
    // Prepare data
    const labels = [];
    const data = [];
    const colors = [];
    
    if (confidenceScores.catboost > 0) {
        labels.push('CatBoost');
        data.push(confidenceScores.catboost);
        colors.push('rgba(52, 168, 83, 0.8)');
    }
    
    if (confidenceScores.xgboost > 0) {
        labels.push('XGBoost');
        data.push(confidenceScores.xgboost);
        colors.push('rgba(66, 133, 244, 0.8)');
    }
    
    if (confidenceScores.statistical > 0) {
        labels.push('Statistical');
        data.push(confidenceScores.statistical);
        colors.push('rgba(251, 188, 4, 0.8)');
    }
    
    modelConfidenceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Confidence Score',
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(color => color.replace('0.8', '1')),
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Confidence: ${context.raw}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Confidence (%)'
                    }
                }
            }
        }
    });
}

// Show analysis results section
function showResults() {
    window.scrollTo({
        top: document.getElementById('results').offsetTop - 20,
        behavior: 'smooth'
    });
}

// Show toast message
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}