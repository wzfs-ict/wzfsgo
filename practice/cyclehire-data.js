/* Weihai Cycle Hire — shared case-study workbook for SheetLab */
(function () {
  var rows = [
    ["H001", "Park", "MB", 3, "Y"], ["H002", "Chen", "CB", 1.5, "N"], ["H003", "Lee", "EB", 6, "Y"],
    ["H004", "Wang", "TB", 2, "N"], ["H005", "Kim", "MB", 5, "N"], ["H006", "Zhao", "EB", 2.5, "Y"],
    ["H007", "Choi", "CB", 4, "Y"], ["H008", "Liu", "MB", 1, "N"], ["H009", "Jung", "EB", 8, "N"],
    ["H010", "Sun", "CB", 3, "Y"]
  ];
  var hire = {
    A1: "Hire ID", B1: "Customer", C1: "Bike Code", D1: "Hours", E1: "Member", F1: "Rate", G1: "Cost",
    H1: "Discount", I1: "Total", J1: "Hire Type", L1: "Member discount", L2: 0.1,
    A13: "Members", A14: "E-Bike takings", A15: "Average total", A16: "Hires over 3 h", A17: "Avg total (members)"
  };
  rows.forEach(function (r, i) { ["A", "B", "C", "D", "E"].forEach(function (c, j) { hire[c + (i + 2)] = r[j]; }); });

  window.CYCLE_HIRE = {
    sheets: {
      Hire: {
        cells: hire, cols: 12, rows: 17,
        fmt: { F: "cur", G: "cur", H: "cur", I: "cur" },
        cellFmt: { L2: "pct", A13: "h", A14: "h", A15: "h", A16: "h", A17: "h", C14: "cur", C15: "cur", C17: "cur" }
      },
      Rates: {
        cells: { A1: "Code", B1: "Bike Type", C1: "Rate per hour", A2: "CB", B2: "City Bike", C2: 15, A3: "EB", B3: "E-Bike", C3: 35, A4: "MB", B4: "Mountain Bike", C4: 25, A5: "TB", B5: "Tandem", C5: 30 },
        cols: 3, rows: 5, fmt: { C: "cur" }
      }
    },
    names: { RATES: "Rates!$A$2:$C$5" }
  };

  window.CYCLE_HIRE_TASKS = [
    { id: "rate", fill: "F2:F11", title: "Rate (column F)", marks: 5,
      prompt: "In <code>F2</code> use a lookup function to return the <strong>rate per hour</strong> for the bike code from the Rates sheet (named range <code>RATES</code>). It will be copied down to F11.",
      hint: "VLOOKUP(what to find, where to look, which column, FALSE). The rate is in column 3 of RATES.",
      answer: "=VLOOKUP(C2,RATES,3,FALSE)", alt: ["=VLOOKUP(C2,Rates!$A$2:$C$5,3,FALSE)", "=XLOOKUP(C2,Rates!$A$2:$A$5,Rates!$C$2:$C$5)"] },
    { id: "cost", fill: "G2:G11", title: "Cost (column G)", marks: 2,
      prompt: "In <code>G2</code> calculate the Cost = Hours × Rate.",
      hint: "Multiply the hours in column D by the rate in column F.",
      answer: "=D2*F2" },
    { id: "disc", fill: "H2:H11", title: "Discount (column H)", marks: 4,
      prompt: "In <code>H2</code>: if the customer is a member (E2 is Y), the discount is Cost × the member discount in <code>L2</code>; otherwise 0. <strong>Watch what happens when it is copied down.</strong>",
      hint: "IF(test, value if true, value if false). L2 must not change when copied — make it absolute: $L$2.",
      answer: "=IF(E2=\"Y\",G2*$L$2,0)" },
    { id: "total", fill: "I2:I11", title: "Total (column I)", marks: 2,
      prompt: "In <code>I2</code> calculate Total = Cost − Discount.",
      hint: "Subtract column H from column G.",
      answer: "=G2-H2" },
    { id: "type", fill: "J2:J11", title: "Hire Type (column J)", marks: 4,
      prompt: "In <code>J2</code> display <em>Short</em> if Hours is less than 2, <em>Half day</em> if less than 5, otherwise <em>Full day</em>.",
      hint: "A nested IF: =IF(D2<2,\"Short\",IF(…)). Three results need two IFs.",
      answer: "=IF(D2<2,\"Short\",IF(D2<5,\"Half day\",\"Full day\"))" },
    { id: "members", fill: "C13", title: "Count the members", marks: 2,
      prompt: "In <code>C13</code> count how many hires were by members.",
      hint: "COUNTIF(range, criteria) — the criteria is \"Y\" in speech marks.",
      answer: "=COUNTIF(E2:E11,\"Y\")" },
    { id: "ebike", fill: "C14", title: "E-Bike takings", marks: 3,
      prompt: "In <code>C14</code> add up the Total (column I) for E-Bikes only (code EB).",
      hint: "SUMIF(range to test, criteria, range to add).",
      answer: "=SUMIF(C2:C11,\"EB\",I2:I11)" },
    { id: "avg", fill: "C15", title: "Average total, 2 dp", marks: 2,
      prompt: "In <code>C15</code> calculate the average Total, rounded to 2 decimal places.",
      hint: "Put AVERAGE inside ROUND: ROUND(AVERAGE(…),2).",
      answer: "=ROUND(AVERAGE(I2:I11),2)" },
    { id: "over3", fill: "C16", title: "Hires over 3 hours", marks: 2,
      prompt: "In <code>C16</code> count the hires that lasted <strong>more than</strong> 3 hours.",
      hint: "The criteria is a comparison in speech marks: \">3\".",
      answer: "=COUNTIF(D2:D11,\">3\")" },
    { id: "avgmem", fill: "C17", title: "Average total for members", marks: 3,
      prompt: "In <code>C17</code> calculate the average Total for members only.",
      hint: "AVERAGEIF(range to test, criteria, range to average).",
      answer: "=AVERAGEIF(E2:E11,\"Y\",I2:I11)" }
  ];
})();
