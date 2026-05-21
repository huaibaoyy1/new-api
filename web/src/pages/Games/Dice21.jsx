/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  List,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconHistory, IconRefresh } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, showWarning } from '../../helpers';
import GameQuickSwitch from '../../components/games/GameQuickSwitch';
import GameDailyLimitPanel from '../../components/games/GameDailyLimitPanel';

const { Title, Text, Paragraph } = Typography;

const defaultRules = [
  '选择 1、5 或 10 站内余额入场，玩家与庄家各摇 4 颗骰子。',
  '目标是尽量接近 21 点且不能超过 21 点，超过 21 点视为爆点。',
  '玩家每局可免费重摇一次，重摇会替换全部 4 颗骰子。',
  '结算时玩家未爆点且点数高于庄家，或庄家爆点时获胜；同点庄家胜。',
  '普通胜利按 1.6 倍派发，刚好 21 点按 2.5 倍派发，单局最高派发 25 站内余额。',
];

const diceDots = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

const formatAmount = (value) => {
  const number = Number(value || 0);
  return number.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};

const formatTime = (timestamp) => {
  if (!timestamp) return '-';
  return new Date(timestamp * 1000).toLocaleString();
};

const getResultLabel = (result) => {
  if (result === 'win') return '玩家胜';
  if (result === 'lose') return '庄家胜';
  return '待开盅';
};

const getResultTone = (result) => {
  if (result === 'win') return 'green';
  if (result === 'lose') return 'red';
  return 'orange';
};

const DiceFace = ({ value, reveal = 1 }) => (
  <div
    className='dice21-die'
    style={{
      opacity: reveal,
      transform: `translateY(${Math.round((1 - reveal) * 16)}px) rotate(var(--dice-rotate, -4deg))`,
    }}
  >
    {Array.from({ length: 9 }, (_, index) => {
      const dotIndex = index + 1;
      const visible = diceDots[value]?.includes(dotIndex);
      return (
        <span
          key={dotIndex}
          className={`dice21-die-dot ${visible ? 'is-visible' : 'is-hidden'}`}
        />
      );
    })}
  </div>
);

const DiceRow = ({ dice = [], revealProgress = 1 }) => {
  const values = dice.length > 0 ? dice : [1, 2, 3, 4];
  return (
    <div className='dice21-dice-row'>
      {values.map((value, index) => {
        const reveal = Math.max(
          0,
          Math.min(1, revealProgress * values.length - index),
        );
        return <DiceFace key={`${value}-${index}`} value={value} reveal={reveal} />;
      })}
    </div>
  );
};

const CupBoard = ({
  title,
  subtitle,
  dice = [],
  total,
  revealed,
  shaking,
  onReveal,
  tone = 'orange',
}) => {
  const dragRef = useRef({ active: false, startY: 0, progress: 0 });
  const [dragProgress, setDragProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const canDrag = dice.length > 0 && !revealed && !shaking;
  const progress = revealed ? 1 : dragProgress;

  useEffect(() => {
    if (!revealed) {
      dragRef.current = { active: false, startY: 0, progress: 0 };
      setDragProgress(0);
      setDragging(false);
    }
  }, [revealed, dice]);

  const handlePointerDown = (event) => {
    if (!canDrag) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      active: true,
      startY: event.clientY,
      progress: dragProgress,
    };
    setDragging(true);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current.active || !canDrag) return;
    const movedUp = Math.max(0, dragRef.current.startY - event.clientY);
    const nextProgress = Math.max(
      0,
      Math.min(1, dragRef.current.progress + movedUp / 132),
    );
    setDragProgress(nextProgress);
  };

  const handlePointerEnd = (event) => {
    if (!dragRef.current.active) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current.active = false;
    setDragging(false);
    if (dragProgress >= 0.82) {
      setDragProgress(1);
      onReveal?.();
      return;
    }
    setDragProgress(0);
  };

  return (
    <div className={`dice21-board ${tone === 'cyan' ? 'is-player' : ''}`}>
      <div className='dice21-board-header'>
        <div className='dice21-board-copy'>
          <div className='dice21-board-title'>{title}</div>
          <div className='dice21-board-subtitle'>{subtitle}</div>
        </div>
        <div className={`dice21-board-status ${revealed ? 'is-open' : ''}`}>
          {revealed ? `合计 ${total || '-'}` : '暗盅'}
        </div>
      </div>

      <div
        className={`dice21-cup-zone ${canDrag ? 'can-drag' : ''} ${
          revealed ? 'is-open' : ''
        } ${dragging ? 'is-dragging' : ''}`}
        style={{
          '--cup-lift': progress,
          '--dice-peek': progress,
        }}
      >
        <div className='dice21-cup-shadow' />
        <div className='dice21-cup-dice'>
          <DiceRow dice={dice} revealProgress={progress} />
        </div>
        <button
          type='button'
          className={`dice21-cup ${tone === 'cyan' ? 'is-player' : ''} ${
            revealed ? 'is-open' : ''
          } ${shaking ? 'is-shaking' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <span className='dice21-cup-grain one' />
          <span className='dice21-cup-grain two' />
          <span className='dice21-cup-grain three' />
          <span className='dice21-cup-label'>
            {canDrag ? '按住上拖' : revealed ? '已开盅' : '暗盅'}
          </span>
        </button>
      </div>
    </div>
  );
};

const DiceTable = ({
  round,
  dealerRevealed,
  playerRevealed,
  shaking,
  onRevealDealer,
  onRevealPlayer,
}) => {
  const settled = round?.status === 'settled';
  const hasRound = Boolean(round);

  return (
    <div className='relative flex h-full min-h-[430px] w-full flex-1 flex-col justify-center overflow-hidden rounded-[2rem] border border-amber-200/45 bg-[radial-gradient(ellipse_at_center,#166534_0%,#14532d_42%,#052e16_72%,#020617_100%)] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.42)] md:p-4'>
      <div className='absolute inset-5 rounded-[2rem] border border-emerald-200/10 bg-[radial-gradient(ellipse_at_center,rgba(250,204,21,0.11),transparent_54%)]' />
      <div className='absolute inset-x-8 top-1/2 h-40 -translate-y-1/2 rounded-[50%] border border-amber-200/30 bg-amber-200/10 blur-sm' />
      <div className='absolute left-8 right-8 top-8 h-16 rounded-[50%] border-t border-emerald-200/20 bg-emerald-200/5' />
      <div className='absolute bottom-8 left-8 right-8 h-16 rounded-[50%] border-b border-emerald-200/20 bg-black/10' />
      <div className='relative grid items-center gap-3 xl:grid-cols-[minmax(0,1fr)_76px_minmax(0,1fr)]'>
        <div className='order-2 xl:order-1'>
          <CupBoard
            title='玩家骰盅'
            subtitle='你的桌边视角'
            dice={round?.player_dice || []}
            total={round?.player_total}
            revealed={hasRound && (playerRevealed || settled)}
            shaking={shaking}
            onReveal={onRevealPlayer}
            tone='cyan'
          />
        </div>

        <div className='order-1 flex flex-col items-center justify-center self-center xl:order-2'>
          <div className='w-full rounded-2xl border border-amber-200/40 bg-black/35 px-2 py-2 text-center text-[11px] font-black leading-5 text-amber-100 shadow-[0_14px_34px_rgba(0,0,0,0.24)]'>
            <div className='mb-1 text-[10px] tracking-[0.22em] text-amber-200'>
              DICE 21
            </div>
            {settled
              ? `玩家 ${round?.player_total || '-'} 点 / 庄家 ${
                  round?.dealer_total || '-'
                } 点`
              : hasRound
                ? '拖开骰盅查看点数'
                : '等待开局'}
          </div>
        </div>

        <div className='order-3'>
          <CupBoard
            title='庄家骰盅'
            subtitle='老庄家摇出的暗盅'
            dice={round?.dealer_dice || []}
            total={round?.dealer_total}
            revealed={hasRound && (dealerRevealed || settled)}
            shaking={shaking}
            onReveal={onRevealDealer}
          />
        </div>
      </div>
    </div>
  );
};

const HistoryItem = ({ round }) => (
  <List.Item>
    <div className='flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3'>
      <div>
        <div className='flex flex-wrap items-center gap-2'>
          <Text strong>{formatTime(round.created_at)}</Text>
          <Tag color={getResultTone(round.result)}>
            {getResultLabel(round.result)}
          </Tag>
          <Tag color='orange'>入场 {formatAmount(round.bet_amount)}</Tag>
        </div>
        <div className='mt-2 text-sm text-slate-600'>
          玩家 {round.player_total || '-'} 点 / 庄家{' '}
          {round.dealer_total || '-'} 点
        </div>
      </div>
      <div className='text-right'>
        <div className='text-lg font-black text-slate-950'>
          +{formatAmount(round.payout_amount)} 余额
        </div>
        <div className='text-xs text-slate-500'>
          {round.rerolled ? '已再摇' : '未再摇'}
        </div>
      </div>
    </div>
  </List.Item>
);

const Dice21 = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [activeRound, setActiveRound] = useState(null);
  const [selectedBet, setSelectedBet] = useState(1);
  const [acting, setActing] = useState(false);
  const [reliefClaiming, setReliefClaiming] = useState(false);
  const [dealerRevealed, setDealerRevealed] = useState(false);
  const [playerRevealed, setPlayerRevealed] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);

  const loadStatus = async ({ syncActiveRound = true } = {}) => {
    setLoading(true);
    try {
      const res = await API.get('/api/games/dice-21/status');
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('获取游戏状态失败'));
        return;
      }
      setStatus(data);
      if (syncActiveRound) {
        const round = data?.current_round || null;
        setActiveRound(round);
        const settled = round?.status === 'settled';
        setDealerRevealed(Boolean(settled));
        setPlayerRevealed(Boolean(settled));
      }
      if (!selectedBet && data?.bet_amounts?.length > 0) {
        setSelectedBet(data.bet_amounts[0]);
      }
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const stopShakeLater = () => {
    setTimeout(() => setShaking(false), 760);
  };

  const clearRoundView = () => {
    setActiveRound(null);
    setDealerRevealed(false);
    setPlayerRevealed(false);
    setShaking(false);
    loadStatus({ syncActiveRound: false });
  };

  const createRound = async () => {
    setActing(true);
    setShaking(true);
    setDealerRevealed(false);
    setPlayerRevealed(false);
    try {
      const res = await API.post('/api/games/dice-21/rounds', {
        bet_amount: selectedBet,
      });
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('开局失败'));
        return;
      }
      setActiveRound(data);
      await loadStatus({ syncActiveRound: false });
      showSuccess(t('双方骰盅已落桌'));
    } catch (error) {
      showError(error);
    } finally {
      stopShakeLater();
      setActing(false);
    }
  };

  const rerollRound = async () => {
    if (!activeRound?.id) return;
    setActing(true);
    setShaking(true);
    setDealerRevealed(false);
    setPlayerRevealed(false);
    try {
      const res = await API.post(
        `/api/games/dice-21/rounds/${activeRound.id}/reroll`,
      );
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('再摇失败'));
        return;
      }
      setActiveRound(data);
      showSuccess(t('再摇完成，按住骰盅向上拖动查看点数'));
    } catch (error) {
      showError(error);
    } finally {
      stopShakeLater();
      setActing(false);
    }
  };

  const settleRound = async () => {
    if (!activeRound?.id) return;
    setActing(true);
    try {
      const res = await API.post(
        `/api/games/dice-21/rounds/${activeRound.id}/settle`,
      );
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('结算失败'));
        return;
      }
      setActiveRound(data);
      setPlayerRevealed(true);
      setDealerRevealed(true);
      await loadStatus({ syncActiveRound: false });
      if (data?.result === 'win') {
        showSuccess(`玩家胜 +${formatAmount(data.payout_amount)} 站内余额`);
      } else {
        showWarning(t('本局庄家胜'));
      }
    } catch (error) {
      showError(error);
    } finally {
      setActing(false);
    }
  };

  const claimRelief = async () => {
    setReliefClaiming(true);
    try {
      const res = await API.post('/api/games/relief/claim');
      const { success, message } = res.data || {};
      if (!success) {
        showError(message || t('领取救助资金失败'));
        return;
      }
      showSuccess(t('救助资金已领取'));
      await loadStatus({ syncActiveRound: false });
    } catch (error) {
      showError(error);
    } finally {
      setReliefClaiming(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const hasRound = Boolean(activeRound);
  const settled = activeRound?.status === 'settled';
  const dailyRemaining = Number(status?.daily_limit?.remaining_count ?? 1);
  const canStart =
    Number(status?.user_balance || 0) >= Number(selectedBet || 0) &&
    dailyRemaining > 0 &&
    !activeRound;
  const rules = status?.rules?.length ? status.rules : defaultRules;

  if (loading && !status) {
    return (
      <div className='min-h-[calc(100vh-64px)] px-4 pb-10 pt-24 md:px-8'>
        <div className='mx-auto flex max-w-6xl justify-center py-20'>
          <Spin size='large' />
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-[calc(100vh-64px)] bg-[radial-gradient(circle_at_18%_10%,#fed7aa_0%,transparent_28%),radial-gradient(circle_at_82%_22%,#67e8f9_0%,transparent_24%),linear-gradient(135deg,#431407_0%,#7c2d12_38%,#020617_100%)] px-4 pb-10 pt-24 md:px-8'>
      <style>
        {`
          .dice21-die {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(3, 1fr);
            gap: 2px;
            padding: 6px;
            align-items: center;
            justify-items: center;
            background:
              radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95), rgba(255,255,255,0.25) 26%, transparent 34%),
              linear-gradient(145deg, #ffffff 0%, #f3f4f6 48%, #cbd5e1 100%);
            border: 1px solid rgba(255,255,255,0.9);
            box-shadow:
              inset -7px -9px 14px rgba(15,23,42,0.18),
              inset 5px 5px 10px rgba(255,255,255,0.9),
              0 13px 22px rgba(15,23,42,0.34);
            transition: opacity 0.16s ease, transform 0.16s ease;
          }
          .dice21-die:nth-child(2) { --dice-rotate: 5deg; }
          .dice21-die:nth-child(3) { --dice-rotate: -8deg; }
          .dice21-die:nth-child(4) { --dice-rotate: 7deg; }
          .dice21-die-dot {
            width: 6px;
            height: 6px;
            border-radius: 999px;
            background: radial-gradient(circle at 35% 35%, #64748b 0%, #111827 64%, #020617 100%);
            box-shadow: inset 1px 1px 2px rgba(255,255,255,0.22);
          }
          .dice21-die-dot.is-visible {
            opacity: 1;
          }
          .dice21-die-dot.is-hidden {
            opacity: 0;
          }
          .dice21-dice-row {
            display: flex;
            flex-wrap: nowrap;
            justify-content: center;
            align-items: center;
            gap: 6px;
            transform: scale(0.9);
          }
          .dice21-board {
            position: relative;
            min-height: 308px;
            border-radius: 1.5rem;
            border: 1px solid rgba(255,255,255,0.34);
            padding: 14px;
            background:
              radial-gradient(circle at 50% 36%, rgba(253,186,116,0.22), transparent 38%),
              linear-gradient(180deg, rgba(15,23,42,0.72), rgba(2,6,23,0.88));
            box-shadow: inset 0 0 36px rgba(255,255,255,0.08), 0 16px 40px rgba(0,0,0,0.3);
          }
          .dice21-board.is-player {
            background:
              radial-gradient(circle at 50% 24%, rgba(103,232,249,0.22), transparent 35%),
              linear-gradient(180deg, rgba(15,23,42,0.72), rgba(2,6,23,0.88));
          }
          .dice21-board-header {
            position: relative;
            z-index: 5;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            min-height: 48px;
            margin-bottom: 8px;
            padding: 8px 10px;
            border-radius: 14px;
            background: linear-gradient(135deg, #fff7ed 0%, #fde68a 100%);
            border: 2px solid rgba(146,64,14,0.72);
            box-shadow: 0 12px 26px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.9);
          }
          .dice21-board-copy {
            min-width: 0;
          }
          .dice21-board-title {
            max-width: 150px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #111827 !important;
            font-size: 15px;
            font-weight: 1000;
            line-height: 1.15;
            letter-spacing: 0.02em;
            text-shadow: 0 1px 0 rgba(255,255,255,0.88);
          }
          .dice21-board-subtitle {
            max-width: 150px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin-top: 3px;
            color: #7c2d12 !important;
            font-size: 11px;
            font-weight: 900;
            line-height: 1.2;
          }
          .dice21-board-status {
            flex: 0 0 auto;
            min-width: 52px;
            border-radius: 999px;
            padding: 6px 9px;
            background: #111827;
            border: 1px solid rgba(17,24,39,0.9);
            color: #fff7ed !important;
            font-size: 11px;
            font-weight: 1000;
            line-height: 1;
            text-align: center;
            box-shadow: 0 8px 18px rgba(17,24,39,0.28);
          }
          .dice21-board-status.is-open {
            background: #ecfeff;
            border-color: #0891b2;
            color: #0f172a !important;
          }
          .dice21-cup-zone {
            position: relative;
            width: min(100%, 330px);
            height: 198px;
            margin: 10px auto 0;
            border-radius: 44% 44% 48% 48%;
            padding-top: 100px;
            background: radial-gradient(ellipse at center, rgba(146,64,14,0.98) 0%, rgba(67,20,7,0.95) 46%, rgba(15,23,42,0.98) 100%);
            box-shadow: inset 0 18px 36px rgba(0,0,0,0.45), 0 24px 44px rgba(0,0,0,0.28);
            overflow: hidden;
          }
          .dice21-cup-dice {
            position: relative;
            z-index: 1;
            width: 202px;
            min-height: 58px;
            margin: 0 auto;
            opacity: var(--dice-peek, 0);
            transform: translateY(calc(24px - (24px * var(--dice-peek, 0)))) scale(calc(0.8 + (0.1 * var(--dice-peek, 0))));
            clip-path: inset(calc(100% - (100% * var(--dice-peek, 0))) 0 0 0 round 18px);
            transition: opacity 0.22s ease, transform 0.22s ease, clip-path 0.22s ease;
          }
          .dice21-cup-zone.is-open .dice21-cup-dice {
            opacity: 1;
            transform: translateY(0) scale(0.9);
            clip-path: inset(0 0 0 0 round 18px);
          }
          .dice21-cup-zone.is-dragging .dice21-cup-dice,
          .dice21-cup-zone.is-dragging .dice21-cup {
            transition: none;
          }
          .dice21-cup-shadow {
            position: absolute;
            z-index: 1;
            left: 50%;
            top: 70px;
            width: 218px;
            height: 72px;
            transform: translateX(-50%);
            border-radius: 50%;
            background: radial-gradient(ellipse at center, rgba(0,0,0,0.82) 0%, rgba(67,20,7,0.82) 52%, rgba(0,0,0,0) 72%);
            opacity: calc(0.18 + (0.82 * var(--dice-peek, 0)));
            transition: opacity 0.22s ease;
          }
          .dice21-cup {
            position: absolute;
            z-index: 2;
            left: 50%;
            top: 20px;
            width: 208px;
            height: 160px;
            border: 0;
            border-radius: 36px 36px 48px 48px / 28px 28px 68px 68px;
            transform: translateX(-50%) translateY(calc(-104px * var(--cup-lift, 0))) rotateX(calc(13deg * var(--cup-lift, 0))) scale(calc(1 - (0.02 * var(--cup-lift, 0))));
            transform-origin: 50% 18%;
            background:
              radial-gradient(ellipse at 50% 13%, rgba(255,237,213,0.28), transparent 18%),
              linear-gradient(90deg, rgba(255,255,255,0.14), transparent 18%, rgba(0,0,0,0.15) 82%, rgba(255,255,255,0.08)),
              repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 7px, rgba(0,0,0,0.08) 7px 14px),
              linear-gradient(145deg, #a16207 0%, #78350f 38%, #451a03 70%, #1c1917 100%);
            box-shadow:
              inset 11px 0 20px rgba(255,237,213,0.16),
              inset -18px -8px 26px rgba(0,0,0,0.42),
              inset 0 18px 18px rgba(255,237,213,0.12),
              0 34px 48px rgba(0,0,0,0.46);
            color: #fff7ed;
            overflow: hidden;
            transition: transform 0.22s ease, opacity 0.8s ease, filter 0.8s ease;
            touch-action: none;
            user-select: none;
            cursor: grab;
          }
          .dice21-cup.is-open {
            transform: translateX(-50%) translateY(-104px) rotateX(13deg) scale(0.98);
            opacity: 0.82;
            filter: blur(0.3px);
          }
          .dice21-cup.can-drag:active,
          .dice21-cup:active {
            cursor: grabbing;
          }
          .dice21-cup::before {
            content: '';
            position: absolute;
            left: 16px;
            right: 16px;
            top: 7px;
            height: 28px;
            border-radius: 50%;
            background: radial-gradient(ellipse at center, #1c1917 0%, #3f1d0b 48%, #b45309 72%, #fde68a 100%);
            box-shadow: inset 0 10px 16px rgba(0,0,0,0.78), 0 5px 10px rgba(255,237,213,0.14);
          }
          .dice21-cup::after {
            content: '';
            position: absolute;
            left: 15px;
            right: 15px;
            bottom: 8px;
            height: 22px;
            border-radius: 50%;
            background: linear-gradient(180deg, rgba(253,230,138,0.25), rgba(69,26,3,0.36));
          }
          .dice21-cup-grain {
            position: absolute;
            left: 30px;
            right: 24px;
            height: 2px;
            border-radius: 999px;
            background: rgba(253,230,138,0.24);
          }
          .dice21-cup-grain.one { top: 50px; transform: rotate(-5deg); }
          .dice21-cup-grain.two { top: 70px; transform: rotate(3deg); }
          .dice21-cup-grain.three { top: 92px; transform: rotate(-2deg); }
          .dice21-cup-label {
            position: absolute;
            left: 50%;
            bottom: 19px;
            transform: translateX(-50%);
            white-space: nowrap;
            border-radius: 999px;
            background: rgba(0,0,0,0.34);
            padding: 4px 12px;
            font-size: 11px;
            font-weight: 900;
          }
          .dice21-cup.is-shaking {
            animation: dice21CupShake 0.56s ease-in-out infinite;
          }
          @keyframes dice21CupShake {
            0%, 100% { transform: translateX(-50%) translateY(0) rotate(0deg); }
            20% { transform: translateX(-50%) translateY(-6px) rotate(-5deg); }
            40% { transform: translateX(-50%) translateY(5px) rotate(5deg); }
            60% { transform: translateX(-50%) translateY(-4px) rotate(3deg); }
            80% { transform: translateX(-50%) translateY(4px) rotate(-3deg); }
          }
          @keyframes dice21DealerBody {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-5px) rotate(1deg); }
          }
          @media (max-width: 768px) {
            .dice21-board { min-height: 320px; }
            .dice21-cup-zone { height: 220px; padding-top: 112px; }
            .dice21-cup { width: 210px; height: 166px; }
            .dice21-die { width: 40px; height: 40px; }
            .dice21-dice-row { gap: 5px; transform: scale(0.88); }
          }
          @media (prefers-reduced-motion: reduce) {
            .dice21-cup { animation: none !important; transition: none !important; }
          }
        `}
      </style>

      <div className='mx-auto max-w-7xl'>
        <div className='mb-4 flex flex-col gap-3 rounded-[1.5rem] border border-orange-200/40 bg-white/10 p-4 shadow-[0_18px_46px_rgba(0,0,0,0.22)] backdrop-blur md:flex-row md:items-start md:justify-between'>
          <div>
            <Tag color='orange' size='large'>
              站内余额小游戏
            </Tag>
            <Title heading={3} className='!mb-1 !mt-2 !text-white'>
              骰盅 21
            </Title>
            <Paragraph className='!mb-0 !max-w-2xl !text-sm !font-semibold !text-orange-50'>
              庄家与你各持一只暗盅。开局后双方摇骰，按住骰盅向上拖动可逐步查看骰子；最终开盅比点，越接近 21 点越好，爆点即输。
            </Paragraph>
          </div>

          <div className='flex flex-col gap-3 md:items-end'>
            <GameQuickSwitch currentKey='dice-21' />
            <Space wrap>
              <Button icon={<IconHistory />} onClick={() => setHistoryVisible(true)}>
                最近牌局
              </Button>
              <Button icon={<IconRefresh />} onClick={() => loadStatus()} loading={loading}>
                刷新
              </Button>
            </Space>
          </div>
        </div>

        <div className='grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_340px]'>
          <div className='flex min-h-full'>
            <Card
              bodyStyle={{ background: 'transparent', height: '100%', padding: 0 }}
              className='flex-1 !overflow-hidden !rounded-[2rem] !border-0 !bg-transparent'
            >
              <div className='flex h-full min-h-[500px] flex-col rounded-[1.5rem] border border-orange-200/45 bg-black/20 p-3 backdrop-blur md:p-4'>
                <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
                  <div>
                    <Text className='!text-sm !font-black !text-orange-100'>
                      当前桌面
                    </Text>
                    <div className='text-2xl font-black text-white'>
                      {activeRound
                        ? `${formatAmount(activeRound.bet_amount)} 站内余额`
                        : `${formatAmount(selectedBet)} 站内余额`}
                    </div>
                  </div>
                  <div className='flex flex-col gap-3 md:items-end'>
                    <Tag
                      color={getResultTone(activeRound?.result)}
                      size='large'
                      className='!px-4 !py-2 !text-base !font-black'
                    >
                      {getResultLabel(activeRound?.result)}
                    </Tag>
                  </div>
                </div>

                <div className='flex min-h-0 flex-1'>
                  <DiceTable
                    round={hasRound ? activeRound : null}
                    dealerRevealed={dealerRevealed}
                    playerRevealed={playerRevealed}
                    shaking={shaking}
                    onRevealDealer={() => setDealerRevealed(true)}
                    onRevealPlayer={() => setPlayerRevealed(true)}
                  />
                </div>

                <div className='mt-3 min-h-[44px]'>
                  {activeRound && !settled ? (
                    <div className='grid gap-3 md:grid-cols-2'>
                      <Button
                        size='large'
                        disabled={!hasRound || !activeRound?.can_reroll || settled}
                        loading={acting && !settled}
                        onClick={rerollRound}
                        className='!h-11 !rounded-2xl !font-black'
                      >
                        再摇一次
                      </Button>
                      <Button
                        theme='solid'
                        type='warning'
                        size='large'
                        disabled={!hasRound || !activeRound?.can_settle || settled}
                        loading={acting}
                        onClick={settleRound}
                        className='!h-11 !rounded-2xl !font-black'
                      >
                        开盅比点
                      </Button>
                    </div>
                  ) : (
                    <div className='flex h-12 items-center justify-center rounded-2xl border border-amber-200/20 bg-black/20 px-4 text-center text-sm font-black text-amber-100'>
                      {!activeRound
                        ? '右侧完成开局设置后开始摇盅'
                        : '本局已结算，可在右侧直接再来一局'}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className='flex min-h-[500px] flex-col gap-4'>
            <GameDailyLimitPanel
              dailyLimit={status?.daily_limit}
              onClaim={claimRelief}
              claiming={reliefClaiming}
            />

            <div className='min-h-[98px] rounded-[1.5rem] border border-amber-300 bg-[linear-gradient(145deg,#fff7ed_0%,#fed7aa_100%)] p-4 text-slate-950 shadow-[0_18px_46px_rgba(67,20,7,0.24)]'>
              <Text className='!text-sm !font-black !text-slate-800'>
                我的余额
              </Text>
              <div className='mt-1 text-3xl font-black text-slate-950'>
                {formatAmount(status?.user_balance)}{' '}
                <span className='text-base text-slate-800'>站内余额</span>
              </div>
            </div>

            <div className='h-[244px] rounded-[1.5rem] border border-amber-300 bg-[linear-gradient(145deg,#fffaf0_0%,#fed7aa_100%)] p-4 text-slate-950 shadow-[0_18px_46px_rgba(67,20,7,0.24)]'>
              {!activeRound ? (
                <div className='flex h-full flex-col justify-between gap-4'>
                  <div>
                    <div className='text-lg font-black text-slate-950'>
                      开局设置
                    </div>
                    <div className='mt-1 text-sm font-bold text-slate-700'>
                      选择入场额后开始摇盅。
                    </div>
                  </div>
                  <div className='grid grid-cols-3 gap-2'>
                    {(status?.bet_amounts || [1, 5, 10]).map((amount) => {
                      const selected = selectedBet === amount;
                      return (
                        <button
                          key={amount}
                          type='button'
                          onClick={() => setSelectedBet(amount)}
                          className={`rounded-2xl border px-3 py-3 text-center shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition ${
                            selected
                              ? 'border-amber-600 bg-[linear-gradient(135deg,#facc15_0%,#fb923c_100%)] text-slate-950'
                              : 'border-amber-300 bg-white text-slate-800 hover:bg-amber-50'
                          }`}
                        >
                          <div className='text-2xl font-black'>{amount}</div>
                          <div className='text-xs font-bold'>站内余额</div>
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    theme='solid'
                    type='warning'
                    size='large'
                    disabled={!canStart}
                    loading={acting}
                    onClick={createRound}
                    className='!h-11 !rounded-2xl !font-black'
                  >
                    开始摇盅
                  </Button>
                </div>
              ) : settled ? (
                <div className='flex h-full flex-col justify-between gap-3'>
                  <div>
                    <div className='text-base font-black text-slate-950'>
                      本局结算
                    </div>
                    <div className='mt-2 rounded-2xl bg-white px-3 py-2 text-slate-950 shadow-sm'>
                      <div className='text-sm font-bold text-slate-600'>
                        结果
                      </div>
                      <div className='mt-1 text-xl font-black'>
                        {getResultLabel(activeRound.result)}
                      </div>
                      <div className='mt-1 text-sm font-bold text-slate-700'>
                        派奖 +{formatAmount(activeRound.payout_amount)} 站内余额
                      </div>
                    </div>
                  </div>
                  <Button
                    size='large'
                    onClick={clearRoundView}
                    className='!h-11 !rounded-2xl !font-black'
                  >
                    再来一局
                  </Button>
                </div>
              ) : (
                <div className='flex h-full flex-col justify-between gap-3'>
                  <div>
                    <div className='text-base font-black text-slate-950'>
                      当前入场
                    </div>
                    <div className='mt-2 rounded-2xl bg-white px-3 py-2 text-slate-950 shadow-sm'>
                      <div className='text-2xl font-black'>
                        {formatAmount(activeRound.bet_amount)}
                        <span className='ml-1 text-sm'>站内余额</span>
                      </div>
                    </div>
                  </div>
                  <div className='rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold leading-6 text-slate-800'>
                    可先拖开玩家骰盅查看点数，再选择再摇或开盅比点。
                  </div>
                </div>
              )}
            </div>

            <div className='flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-amber-300 bg-[linear-gradient(145deg,#fffaf0_0%,#ffedd5_100%)] p-4 text-slate-950 shadow-[0_18px_46px_rgba(67,20,7,0.24)]'>
              <div className='mb-2 text-base font-black text-slate-950'>
                玩法规则
              </div>
              <div className='min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1'>
                {rules.map((rule, index) => (
                  <div
                    key={`${rule}-${index}`}
                    className='rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold leading-5 text-slate-900 shadow-sm'
                  >
                    {rule}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        title='最近牌局'
        visible={historyVisible}
        footer={null}
        onCancel={() => setHistoryVisible(false)}
        width={760}
        bodyStyle={{
          maxHeight: 'min(560px, calc(100vh - 260px))',
          overflowY: 'auto',
        }}
      >
        <List
          dataSource={status?.recent_rounds || []}
          emptyContent='暂无记录'
          renderItem={(round) => <HistoryItem round={round} />}
        />
      </Modal>
    </div>
  );
};

export default Dice21;

