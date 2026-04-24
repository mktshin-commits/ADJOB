const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.join(__dirname, '회원사 리스트.xlsx');
const outputPath = path.join(__dirname, 'members.json');

try {
  // Read Excel file
  const workbook = XLSX.readFile(excelPath);
  
  // Get first sheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON array
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  // Check if "회사명" column exists
  if (data.length > 0 && '회사명' in data[0]) {
    // Extract company names
    const members = data
      .map(row => row['회사명'])
      .filter(name => name !== undefined && name !== null && name !== '');
    
    // Write to JSON file
    fs.writeFileSync(outputPath, JSON.stringify(members, null, 2), 'utf8');
    
    console.log(`Success: Saved ${members.length} members to members.json`);
  } else {
    const keys = data.length > 0 ? Object.keys(data[0]) : [];
    console.log("Error: '회사명' 칼럼이 없습니다. 존재하는 칼럼:", keys);
  }
  
} catch (e) {
  console.log(`Error: ${e.message}`);
}