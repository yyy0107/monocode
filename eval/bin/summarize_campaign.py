#!/usr/bin/env python3
"""Offline campaign summary using the same calibration gate as the live runner. No model calls."""
import argparse, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--campaign',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    if args.out.exists():raise SystemExit('Output must be new')
    subprocess.run(['node',str(ROOT/'bin/eval.mjs'),'replay','--campaign',str(args.campaign.resolve()),'--out',str(args.out.resolve())],cwd=ROOT.parent,check=True)
if __name__=='__main__':main()
