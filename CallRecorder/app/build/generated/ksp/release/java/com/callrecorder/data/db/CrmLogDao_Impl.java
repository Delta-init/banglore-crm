package com.callrecorder.data.db;

import android.database.Cursor;
import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.room.CoroutinesRoom;
import androidx.room.EntityInsertionAdapter;
import androidx.room.RoomDatabase;
import androidx.room.RoomSQLiteQuery;
import androidx.room.SharedSQLiteStatement;
import androidx.room.util.CursorUtil;
import androidx.room.util.DBUtil;
import androidx.sqlite.db.SupportSQLiteStatement;
import java.lang.Class;
import java.lang.Exception;
import java.lang.Long;
import java.lang.Object;
import java.lang.Override;
import java.lang.String;
import java.lang.SuppressWarnings;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import javax.annotation.processing.Generated;
import kotlin.Unit;
import kotlin.coroutines.Continuation;
import kotlinx.coroutines.flow.Flow;

@Generated("androidx.room.RoomProcessor")
@SuppressWarnings({"unchecked", "deprecation"})
public final class CrmLogDao_Impl implements CrmLogDao {
  private final RoomDatabase __db;

  private final EntityInsertionAdapter<CrmLogEntity> __insertionAdapterOfCrmLogEntity;

  private final SharedSQLiteStatement __preparedStmtOfUpdateSyncResult;

  private final SharedSQLiteStatement __preparedStmtOfClearAll;

  public CrmLogDao_Impl(@NonNull final RoomDatabase __db) {
    this.__db = __db;
    this.__insertionAdapterOfCrmLogEntity = new EntityInsertionAdapter<CrmLogEntity>(__db) {
      @Override
      @NonNull
      protected String createQuery() {
        return "INSERT OR ABORT INTO `crm_logs` (`id`,`timestamp`,`phoneNumber`,`callType`,`durationSecs`,`synced`,`callLogId`,`errorMessage`,`systemCallLogId`) VALUES (nullif(?, 0),?,?,?,?,?,?,?,?)";
      }

      @Override
      protected void bind(@NonNull final SupportSQLiteStatement statement,
          @NonNull final CrmLogEntity entity) {
        statement.bindLong(1, entity.getId());
        statement.bindLong(2, entity.getTimestamp());
        statement.bindString(3, entity.getPhoneNumber());
        statement.bindString(4, entity.getCallType());
        statement.bindLong(5, entity.getDurationSecs());
        final int _tmp = entity.getSynced() ? 1 : 0;
        statement.bindLong(6, _tmp);
        if (entity.getCallLogId() == null) {
          statement.bindNull(7);
        } else {
          statement.bindString(7, entity.getCallLogId());
        }
        if (entity.getErrorMessage() == null) {
          statement.bindNull(8);
        } else {
          statement.bindString(8, entity.getErrorMessage());
        }
        if (entity.getSystemCallLogId() == null) {
          statement.bindNull(9);
        } else {
          statement.bindLong(9, entity.getSystemCallLogId());
        }
      }
    };
    this.__preparedStmtOfUpdateSyncResult = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "UPDATE crm_logs SET synced = ?, callLogId = ?, errorMessage = ? WHERE id = ?";
        return _query;
      }
    };
    this.__preparedStmtOfClearAll = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "DELETE FROM crm_logs";
        return _query;
      }
    };
  }

  @Override
  public Object insert(final CrmLogEntity log, final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        __db.beginTransaction();
        try {
          __insertionAdapterOfCrmLogEntity.insert(log);
          __db.setTransactionSuccessful();
          return Unit.INSTANCE;
        } finally {
          __db.endTransaction();
        }
      }
    }, $completion);
  }

  @Override
  public Object updateSyncResult(final int id, final boolean synced, final String callLogId,
      final String errorMessage, final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfUpdateSyncResult.acquire();
        int _argIndex = 1;
        final int _tmp = synced ? 1 : 0;
        _stmt.bindLong(_argIndex, _tmp);
        _argIndex = 2;
        if (callLogId == null) {
          _stmt.bindNull(_argIndex);
        } else {
          _stmt.bindString(_argIndex, callLogId);
        }
        _argIndex = 3;
        if (errorMessage == null) {
          _stmt.bindNull(_argIndex);
        } else {
          _stmt.bindString(_argIndex, errorMessage);
        }
        _argIndex = 4;
        _stmt.bindLong(_argIndex, id);
        try {
          __db.beginTransaction();
          try {
            _stmt.executeUpdateDelete();
            __db.setTransactionSuccessful();
            return Unit.INSTANCE;
          } finally {
            __db.endTransaction();
          }
        } finally {
          __preparedStmtOfUpdateSyncResult.release(_stmt);
        }
      }
    }, $completion);
  }

  @Override
  public Object clearAll(final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfClearAll.acquire();
        try {
          __db.beginTransaction();
          try {
            _stmt.executeUpdateDelete();
            __db.setTransactionSuccessful();
            return Unit.INSTANCE;
          } finally {
            __db.endTransaction();
          }
        } finally {
          __preparedStmtOfClearAll.release(_stmt);
        }
      }
    }, $completion);
  }

  @Override
  public Flow<List<CrmLogEntity>> getAllLogs() {
    final String _sql = "SELECT * FROM crm_logs ORDER BY timestamp DESC";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    return CoroutinesRoom.createFlow(__db, false, new String[] {"crm_logs"}, new Callable<List<CrmLogEntity>>() {
      @Override
      @NonNull
      public List<CrmLogEntity> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfTimestamp = CursorUtil.getColumnIndexOrThrow(_cursor, "timestamp");
          final int _cursorIndexOfPhoneNumber = CursorUtil.getColumnIndexOrThrow(_cursor, "phoneNumber");
          final int _cursorIndexOfCallType = CursorUtil.getColumnIndexOrThrow(_cursor, "callType");
          final int _cursorIndexOfDurationSecs = CursorUtil.getColumnIndexOrThrow(_cursor, "durationSecs");
          final int _cursorIndexOfSynced = CursorUtil.getColumnIndexOrThrow(_cursor, "synced");
          final int _cursorIndexOfCallLogId = CursorUtil.getColumnIndexOrThrow(_cursor, "callLogId");
          final int _cursorIndexOfErrorMessage = CursorUtil.getColumnIndexOrThrow(_cursor, "errorMessage");
          final int _cursorIndexOfSystemCallLogId = CursorUtil.getColumnIndexOrThrow(_cursor, "systemCallLogId");
          final List<CrmLogEntity> _result = new ArrayList<CrmLogEntity>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final CrmLogEntity _item;
            final int _tmpId;
            _tmpId = _cursor.getInt(_cursorIndexOfId);
            final long _tmpTimestamp;
            _tmpTimestamp = _cursor.getLong(_cursorIndexOfTimestamp);
            final String _tmpPhoneNumber;
            _tmpPhoneNumber = _cursor.getString(_cursorIndexOfPhoneNumber);
            final String _tmpCallType;
            _tmpCallType = _cursor.getString(_cursorIndexOfCallType);
            final long _tmpDurationSecs;
            _tmpDurationSecs = _cursor.getLong(_cursorIndexOfDurationSecs);
            final boolean _tmpSynced;
            final int _tmp;
            _tmp = _cursor.getInt(_cursorIndexOfSynced);
            _tmpSynced = _tmp != 0;
            final String _tmpCallLogId;
            if (_cursor.isNull(_cursorIndexOfCallLogId)) {
              _tmpCallLogId = null;
            } else {
              _tmpCallLogId = _cursor.getString(_cursorIndexOfCallLogId);
            }
            final String _tmpErrorMessage;
            if (_cursor.isNull(_cursorIndexOfErrorMessage)) {
              _tmpErrorMessage = null;
            } else {
              _tmpErrorMessage = _cursor.getString(_cursorIndexOfErrorMessage);
            }
            final Long _tmpSystemCallLogId;
            if (_cursor.isNull(_cursorIndexOfSystemCallLogId)) {
              _tmpSystemCallLogId = null;
            } else {
              _tmpSystemCallLogId = _cursor.getLong(_cursorIndexOfSystemCallLogId);
            }
            _item = new CrmLogEntity(_tmpId,_tmpTimestamp,_tmpPhoneNumber,_tmpCallType,_tmpDurationSecs,_tmpSynced,_tmpCallLogId,_tmpErrorMessage,_tmpSystemCallLogId);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
        }
      }

      @Override
      protected void finalize() {
        _statement.release();
      }
    });
  }

  @Override
  public Object getAllLogsSnapshot(final Continuation<? super List<CrmLogEntity>> $completion) {
    final String _sql = "SELECT * FROM crm_logs ORDER BY timestamp DESC";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<List<CrmLogEntity>>() {
      @Override
      @NonNull
      public List<CrmLogEntity> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfTimestamp = CursorUtil.getColumnIndexOrThrow(_cursor, "timestamp");
          final int _cursorIndexOfPhoneNumber = CursorUtil.getColumnIndexOrThrow(_cursor, "phoneNumber");
          final int _cursorIndexOfCallType = CursorUtil.getColumnIndexOrThrow(_cursor, "callType");
          final int _cursorIndexOfDurationSecs = CursorUtil.getColumnIndexOrThrow(_cursor, "durationSecs");
          final int _cursorIndexOfSynced = CursorUtil.getColumnIndexOrThrow(_cursor, "synced");
          final int _cursorIndexOfCallLogId = CursorUtil.getColumnIndexOrThrow(_cursor, "callLogId");
          final int _cursorIndexOfErrorMessage = CursorUtil.getColumnIndexOrThrow(_cursor, "errorMessage");
          final int _cursorIndexOfSystemCallLogId = CursorUtil.getColumnIndexOrThrow(_cursor, "systemCallLogId");
          final List<CrmLogEntity> _result = new ArrayList<CrmLogEntity>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final CrmLogEntity _item;
            final int _tmpId;
            _tmpId = _cursor.getInt(_cursorIndexOfId);
            final long _tmpTimestamp;
            _tmpTimestamp = _cursor.getLong(_cursorIndexOfTimestamp);
            final String _tmpPhoneNumber;
            _tmpPhoneNumber = _cursor.getString(_cursorIndexOfPhoneNumber);
            final String _tmpCallType;
            _tmpCallType = _cursor.getString(_cursorIndexOfCallType);
            final long _tmpDurationSecs;
            _tmpDurationSecs = _cursor.getLong(_cursorIndexOfDurationSecs);
            final boolean _tmpSynced;
            final int _tmp;
            _tmp = _cursor.getInt(_cursorIndexOfSynced);
            _tmpSynced = _tmp != 0;
            final String _tmpCallLogId;
            if (_cursor.isNull(_cursorIndexOfCallLogId)) {
              _tmpCallLogId = null;
            } else {
              _tmpCallLogId = _cursor.getString(_cursorIndexOfCallLogId);
            }
            final String _tmpErrorMessage;
            if (_cursor.isNull(_cursorIndexOfErrorMessage)) {
              _tmpErrorMessage = null;
            } else {
              _tmpErrorMessage = _cursor.getString(_cursorIndexOfErrorMessage);
            }
            final Long _tmpSystemCallLogId;
            if (_cursor.isNull(_cursorIndexOfSystemCallLogId)) {
              _tmpSystemCallLogId = null;
            } else {
              _tmpSystemCallLogId = _cursor.getLong(_cursorIndexOfSystemCallLogId);
            }
            _item = new CrmLogEntity(_tmpId,_tmpTimestamp,_tmpPhoneNumber,_tmpCallType,_tmpDurationSecs,_tmpSynced,_tmpCallLogId,_tmpErrorMessage,_tmpSystemCallLogId);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
          _statement.release();
        }
      }
    }, $completion);
  }

  @Override
  public Object getFailedLogs(final Continuation<? super List<CrmLogEntity>> $completion) {
    final String _sql = "SELECT * FROM crm_logs WHERE synced = 0 AND (errorMessage IS NULL OR errorMessage != '⏳ Retrying…') ORDER BY timestamp DESC";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<List<CrmLogEntity>>() {
      @Override
      @NonNull
      public List<CrmLogEntity> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfTimestamp = CursorUtil.getColumnIndexOrThrow(_cursor, "timestamp");
          final int _cursorIndexOfPhoneNumber = CursorUtil.getColumnIndexOrThrow(_cursor, "phoneNumber");
          final int _cursorIndexOfCallType = CursorUtil.getColumnIndexOrThrow(_cursor, "callType");
          final int _cursorIndexOfDurationSecs = CursorUtil.getColumnIndexOrThrow(_cursor, "durationSecs");
          final int _cursorIndexOfSynced = CursorUtil.getColumnIndexOrThrow(_cursor, "synced");
          final int _cursorIndexOfCallLogId = CursorUtil.getColumnIndexOrThrow(_cursor, "callLogId");
          final int _cursorIndexOfErrorMessage = CursorUtil.getColumnIndexOrThrow(_cursor, "errorMessage");
          final int _cursorIndexOfSystemCallLogId = CursorUtil.getColumnIndexOrThrow(_cursor, "systemCallLogId");
          final List<CrmLogEntity> _result = new ArrayList<CrmLogEntity>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final CrmLogEntity _item;
            final int _tmpId;
            _tmpId = _cursor.getInt(_cursorIndexOfId);
            final long _tmpTimestamp;
            _tmpTimestamp = _cursor.getLong(_cursorIndexOfTimestamp);
            final String _tmpPhoneNumber;
            _tmpPhoneNumber = _cursor.getString(_cursorIndexOfPhoneNumber);
            final String _tmpCallType;
            _tmpCallType = _cursor.getString(_cursorIndexOfCallType);
            final long _tmpDurationSecs;
            _tmpDurationSecs = _cursor.getLong(_cursorIndexOfDurationSecs);
            final boolean _tmpSynced;
            final int _tmp;
            _tmp = _cursor.getInt(_cursorIndexOfSynced);
            _tmpSynced = _tmp != 0;
            final String _tmpCallLogId;
            if (_cursor.isNull(_cursorIndexOfCallLogId)) {
              _tmpCallLogId = null;
            } else {
              _tmpCallLogId = _cursor.getString(_cursorIndexOfCallLogId);
            }
            final String _tmpErrorMessage;
            if (_cursor.isNull(_cursorIndexOfErrorMessage)) {
              _tmpErrorMessage = null;
            } else {
              _tmpErrorMessage = _cursor.getString(_cursorIndexOfErrorMessage);
            }
            final Long _tmpSystemCallLogId;
            if (_cursor.isNull(_cursorIndexOfSystemCallLogId)) {
              _tmpSystemCallLogId = null;
            } else {
              _tmpSystemCallLogId = _cursor.getLong(_cursorIndexOfSystemCallLogId);
            }
            _item = new CrmLogEntity(_tmpId,_tmpTimestamp,_tmpPhoneNumber,_tmpCallType,_tmpDurationSecs,_tmpSynced,_tmpCallLogId,_tmpErrorMessage,_tmpSystemCallLogId);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
          _statement.release();
        }
      }
    }, $completion);
  }

  @NonNull
  public static List<Class<?>> getRequiredConverters() {
    return Collections.emptyList();
  }
}
